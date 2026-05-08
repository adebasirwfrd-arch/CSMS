import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from services.report_engine import ReportEngine
from services.logger_service import log_report, log_error, log_info, log_warning
from typing import List, Optional

router = APIRouter(prefix="/api/reports", tags=["reports"])
report_engine = ReportEngine()

# Hard upload limits to fail fast with a clear error instead of letting
# the platform proxy drop the connection (which surfaces as net::ERR_FAILED
# on the client). These can be tuned via deployment if needed.
MAX_PER_FILE_BYTES = 25 * 1024 * 1024   # 25 MB per file
MAX_TOTAL_BYTES = 80 * 1024 * 1024      # 80 MB combined upload
MAX_SOURCE_FILES = 30


async def _read_upload(upload: UploadFile, label: str) -> bytes:
    """Read an UploadFile fully while enforcing the per-file size cap."""
    content = await upload.read()
    size = len(content)
    if size > MAX_PER_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"{label} '{upload.filename}' is {size / (1024*1024):.1f} MB. "
                f"Max allowed per file is {MAX_PER_FILE_BYTES // (1024*1024)} MB."
            ),
        )
    return content


@router.post("/generate")
async def generate_report(
    template_file: Optional[UploadFile] = File(None),
    source_files: List[UploadFile] = File(...),
    force_csv: Optional[str] = None,
):
    """
    Generate a report by filling a template with data from MULTIPLE source files.
    If force_csv is 'true', output will be CSV regardless of template.
    """
    try:
        if not source_files:
            raise HTTPException(status_code=400, detail="No source files provided.")

        if len(source_files) > MAX_SOURCE_FILES:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Too many source files ({len(source_files)}). "
                    f"Max allowed is {MAX_SOURCE_FILES}."
                ),
            )

        # Read Template (if provided)
        if template_file:
            template_content = await _read_upload(template_file, "Template")
            template_filename = template_file.filename or "template"
        else:
            template_content = b""
            template_filename = "report.csv"

        # Force CSV output if requested
        log_info("REPORT", f"force_csv received: '{force_csv}'")
        if force_csv == "true":
            template_filename = "report.csv"
            log_info("REPORT", "Forcing CSV output. template_filename=report.csv")

        # Read Sources (one at a time, enforcing the combined cap)
        source_contents: List[bytes] = []
        source_filenames: List[str] = []
        total_bytes = len(template_content)

        for idx, sf in enumerate(source_files, start=1):
            content = await _read_upload(sf, "Source")
            total_bytes += len(content)
            if total_bytes > MAX_TOTAL_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"Combined upload size exceeded "
                        f"{MAX_TOTAL_BYTES // (1024*1024)} MB after file #{idx} "
                        f"('{sf.filename}'). Please upload fewer / smaller files."
                    ),
                )
            source_contents.append(content)
            source_filenames.append(sf.filename or f"source_{idx}")

        log_info(
            "REPORT",
            f"Generating: template='{template_filename}' "
            f"sources={len(source_filenames)} total={total_bytes / (1024*1024):.2f}MB",
        )

        # Run the (sync, CPU-heavy) processing in a thread so the event loop
        # stays responsive and the upstream proxy doesn't kill the connection.
        try:
            result = await asyncio.to_thread(
                report_engine.process_request,
                template_content,
                template_filename,
                source_contents,
                source_filenames,
            )
        except Exception as engine_err:
            log_error("REPORT", "Report engine raised", engine_err)
            raise HTTPException(
                status_code=500,
                detail=f"Report engine error: {engine_err}",
            )

        if not result:
            log_warning("REPORT", "Report engine returned empty result")
            raise HTTPException(
                status_code=400,
                detail=(
                    "Failed to generate report. Make sure the template is supported "
                    "(.docx, .xlsx, .csv) and the source files contain extractable data."
                ),
            )

        # Determine media type based on output
        media_type = "application/octet-stream"
        output_filename = f"generated_{template_filename}"
        lower = template_filename.lower()
        if lower.endswith(".docx"):
            media_type = (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
        elif lower.endswith(".xlsx"):
            media_type = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        elif lower.endswith(".csv"):
            media_type = "text/csv"
            output_filename = "generated_report.csv"

        log_report("GENERATE", f"{output_filename} ({len(result)} bytes)")

        return Response(
            content=result,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={output_filename}"},
        )

    except HTTPException:
        raise
    except Exception as e:
        log_error("REPORT", f"Report generation failed: {e}", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview")
async def preview_source_data(source_file: UploadFile = File(...)):
    """
    Preview the data extracted from the source file.
    """
    try:
        source_content = await _read_upload(source_file, "Source")

        filename = (source_file.filename or "").lower()
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            data = await asyncio.to_thread(
                report_engine.parse_excel_source, source_content
            )
        elif filename.endswith(".pdf"):
            data = await asyncio.to_thread(
                report_engine.parse_pdf_source, source_content
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported source file type")

        # PDF parser returns {employee_name, records}; Excel returns a list.
        preview_data = data.get("records", []) if isinstance(data, dict) else data

        return {
            "filename": source_file.filename,
            "record_count": len(preview_data),
            "preview": preview_data[:5],
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("REPORT", f"Preview failed: {e}", e)
        raise HTTPException(status_code=500, detail=str(e))
