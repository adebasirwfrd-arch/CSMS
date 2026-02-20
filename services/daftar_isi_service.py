"""
Daftar Isi PDF Generator Service
Generates a Table of Contents PDF with clickable links to Google Drive folders.
Auto-regenerates when files are uploaded.
"""

import io
import asyncio
from typing import List, Dict, Any
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_LEFT

from services.google_drive import drive_service
from services.logger_service import log_info, log_error, log_warning


class DaftarIsiService:
    """Service to generate and upload Daftar Isi PDF."""
    
    DAFTAR_ISI_FILENAME = "DAFTAR ISI.pdf"
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        # Custom styles
        self.title_style = ParagraphStyle(
            'TitleStyle',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceAfter=20,
            textColor=HexColor('#1a1a1a')
        )
        self.element_style = ParagraphStyle(
            'ElementStyle',
            parent=self.styles['Heading2'],
            fontSize=12,
            spaceBefore=15,
            spaceAfter=5,
            textColor=HexColor('#2563eb'),
            fontName='Helvetica-Bold'
        )
        self.folder_style = ParagraphStyle(
            'FolderStyle',
            parent=self.styles['Normal'],
            fontSize=10,
            leftIndent=20,
            spaceBefore=2,
            textColor=HexColor('#374151')
        )
        self.subfolder_style = ParagraphStyle(
            'SubfolderStyle',
            parent=self.styles['Normal'],
            fontSize=9,
            leftIndent=40,
            spaceBefore=1,
            textColor=HexColor('#6b7280')
        )

    async def generate_and_upload(self, project_folder_id: str, project_name: str) -> bool:
        """
        Generate Daftar Isi PDF and upload to project folder.
        Returns True if successful.
        """
        if not drive_service.enabled or not drive_service.service:
            log_warning("DAFTAR_ISI", "Drive service not available")
            return False
            
        try:
            log_info("DAFTAR_ISI", f"Generating Daftar Isi for project: {project_name}")
            
            # 1. Scan folder structure
            structure = await self._scan_folder_structure(project_folder_id)
            
            if not structure:
                log_warning("DAFTAR_ISI", "No folder structure found")
                return False
            
            # 2. Generate PDF
            pdf_bytes = self._generate_pdf(project_name, structure)
            
            # 3. Delete existing Daftar Isi if exists
            await self._delete_existing_daftar_isi(project_folder_id)
            
            # 4. Upload new PDF
            file_id = await self._upload_pdf(project_folder_id, pdf_bytes)
            
            if file_id:
                log_info("DAFTAR_ISI", f"Successfully uploaded Daftar Isi.pdf: {file_id}")
                return True
            else:
                log_error("DAFTAR_ISI", "Failed to upload Daftar Isi.pdf")
                return False
                
        except Exception as e:
            log_error("DAFTAR_ISI", f"Error generating Daftar Isi: {e}")
            return False

    async def _scan_folder_structure(self, folder_id: str, depth: int = 0, max_depth: int = 3) -> List[Dict[str, Any]]:
        """Scan folder structure recursively and return structured data."""
        if depth >= max_depth:
            return []
            
        structure = []
        try:
            # Get all items in folder
            items = drive_service.fetch_files_in_folder(folder_id)
            folders = [item for item in items if item.get('mimeType') == 'application/vnd.google-apps.folder']
            
            # Sort folders by name (numeric-aware sorting if possible)
            def folder_sort_key(f):
                name = f.get('name', '')
                parts = name.split(' ', 1)
                if parts[0].replace('.', '').isdigit():
                    return [float(p) if p.replace('.', '').isdigit() else 999 for p in parts[0].split('.')]
                return [999, name]

            folders.sort(key=folder_sort_key)
            
            for folder in folders:
                folder_data = {
                    'id': folder['id'],
                    'name': folder['name'],
                    'url': f"https://drive.google.com/drive/folders/{folder['id']}",
                    'children': await self._scan_folder_structure(folder['id'], depth + 1, max_depth)
                }
                structure.append(folder_data)
        except Exception as e:
            log_error("DAFTAR_ISI", f"Error scanning folder {folder_id}: {e}")
            
        return structure

    def _generate_pdf(self, project_name: str, structure: List[Dict[str, Any]]) -> bytes:
        """Generate PDF with folder structure and clickable links."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        story = []
        
        # Title
        title = Paragraph(f"DAFTAR ISI<br/><font size=12>{project_name}</font>", self.title_style)
        story.append(title)
        story.append(Spacer(1, 20))
        
        # Folder structure
        def add_items_to_story(items, level=0):
            for item in items:
                if level == 0:
                    link = f'<a href="{item["url"]}" color="blue">📁 {item["name"]}</a>'
                    story.append(Paragraph(link, self.element_style))
                elif level == 1:
                    child_link = f'<a href="{item["url"]}" color="#4b5563">└── 📂 {item["name"]}</a>'
                    story.append(Paragraph(child_link, self.folder_style))
                else:
                    indent = "      " * (level - 1)
                    sub_link = f'<a href="{item["url"]}" color="#6b7280">{indent}└── 📄 {item["name"]}</a>'
                    story.append(Paragraph(sub_link, self.subfolder_style))
                
                if item.get('children'):
                    add_items_to_story(item['children'], level + 1)

        add_items_to_story(structure)
        
        # Footer
        story.append(Spacer(1, 30))
        footer = Paragraph(
            '<font size=8 color="#9ca3af">Dokumen ini di-generate otomatis oleh CSMS. Klik link untuk membuka folder di Google Drive.</font>',
            self.styles['Normal']
        )
        story.append(footer)
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    async def _delete_existing_daftar_isi(self, folder_id: str):
        """Delete existing Daftar Isi.pdf if exists."""
        try:
            items = drive_service.fetch_files_in_folder(folder_id)
            for item in items:
                if item.get('name') == self.DAFTAR_ISI_FILENAME:
                    drive_service.service.files().delete(fileId=item['id']).execute()
                    log_info("DAFTAR_ISI", f"Deleted existing {self.DAFTAR_ISI_FILENAME}")
                    break
        except Exception as e:
            log_warning("DAFTAR_ISI", f"Could not delete existing file: {e}")

    async def _upload_pdf(self, folder_id: str, pdf_bytes: bytes) -> str:
        """Upload PDF to Google Drive folder."""
        try:
            from googleapiclient.http import MediaIoBaseUpload
            
            file_metadata = {
                'name': self.DAFTAR_ISI_FILENAME,
                'parents': [folder_id],
                'mimeType': 'application/pdf'
            }
            
            media = MediaIoBaseUpload(
                io.BytesIO(pdf_bytes),
                mimetype='application/pdf',
                resumable=True
            )
            
            file = drive_service.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True
            ).execute()
            
            return file.get('id')
        except Exception as e:
            log_error("DAFTAR_ISI", f"Error uploading PDF: {e}")
            return None


# Singleton instance
daftar_isi_service = DaftarIsiService()


async def regenerate_daftar_isi_for_project(project_folder_id: str, project_name: str):
    """Background task to regenerate Daftar Isi PDF."""
    await daftar_isi_service.generate_and_upload(project_folder_id, project_name)
