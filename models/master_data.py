"""Pydantic models for Client & Product Line master data."""
from pydantic import BaseModel
from typing import Optional


class ClientBase(BaseModel):
    name: str
    description: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Client(ClientBase):
    id: int
    created_at: Optional[str] = None


class ProductLineBase(BaseModel):
    name: str
    description: Optional[str] = None
    supervisor_email: Optional[str] = ""
    hse_email: Optional[str] = ""
    manager_email: Optional[str] = ""
    coordinator_email: Optional[str] = ""


class ProductLineCreate(ProductLineBase):
    pass


class ProductLineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    supervisor_email: Optional[str] = None
    hse_email: Optional[str] = None
    manager_email: Optional[str] = None
    coordinator_email: Optional[str] = None


class ProductLine(ProductLineBase):
    id: int
    created_at: Optional[str] = None


class GenerateTemplateRequest(BaseModel):
    client_id: int
    product_line_id: int


class PropagateTemplateRequest(BaseModel):
    client_id: int
    product_line_id: int


class ClientProductTemplate(BaseModel):
    id: int
    client_id: int
    product_line_id: int
    template_folder_name: str
    drive_folder_id: Optional[str] = None
    created_at: Optional[str] = None


class ProductLineEmployeeBase(BaseModel):
    row_no: Optional[int] = None
    name: str = ""
    job_family_description: str = ""
    job_description: str = ""
    access_to_pl: str = "No"
    access_personnel_only: str = "No"
    email: str = ""
    email_reminder: str = "No"


class ProductLineEmployeeCreate(ProductLineEmployeeBase):
    pass


class ProductLineEmployeeUpdate(BaseModel):
    row_no: Optional[int] = None
    name: Optional[str] = None
    job_family_description: Optional[str] = None
    job_description: Optional[str] = None
    access_to_pl: Optional[str] = None
    access_personnel_only: Optional[str] = None
    email: Optional[str] = None
    email_reminder: Optional[str] = None


class ProductLineEmployee(ProductLineEmployeeBase):
    id: int
    product_line_id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SyncProductLineEmployeesRequest(BaseModel):
    use_excel: bool = False
