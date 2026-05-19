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


class ProductLineCreate(ProductLineBase):
    pass


class ProductLineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProductLine(ProductLineBase):
    id: int
    created_at: Optional[str] = None


class GenerateTemplateRequest(BaseModel):
    client_id: int
    product_line_id: int


class ClientProductTemplate(BaseModel):
    id: int
    client_id: int
    product_line_id: int
    template_folder_name: str
    drive_folder_id: Optional[str] = None
    created_at: Optional[str] = None
