
export enum ProjectStatus {
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed'
}

export enum ApartmentStatus {
  Available = 'available',
  Rented = 'rented',
  Maintenance = 'maintenance',
  ForSale = 'for_sale',
  Sold = 'sold'
}

export enum ContractStatus {
  Active = 'active',
  Ended = 'ended',
  Pending = 'pending',
  Canceled = 'canceled',
  Renewed = 'renewed',
  SaleInProgress = 'sale_in_progress',
  SaleCompleted = 'sale_completed',
  SaleCanceled = 'sale_canceled'
}

export enum PaymentStatus {
  Paid = 'paid',
  Pending = 'pending',
  Late = 'late',
  Canceled = 'canceled'
}

export type PaymentMethod = 'especes' | 'cheque' | 'virement' | 'effet';

export interface Project {
  id: string; // Use id for consistency
  project_id: string;
  project_name: string;
  location: string;
  description: string;
  total_apartments: number;
  rented_apartments_count?: number; // Added for dashboard
  sold_apartments_count?: number; // Added for accurate status
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Apartment {
  id: string; // Use id for consistency
  apartment_id: string;
  project_id: string;
  name: string;
  type: 'apartment' | 'garage';
  floor?: string;
  surface_m2: number;
  rooms?: number;
  balcony?: boolean;
  bathroom?: number;
  kitchen?: boolean;
  status: ApartmentStatus;
  price_dh: number; // Represents rent price
  sale_price_dh?: number; // Represents sale price
  owner_name: string;
  description: string;
  current_contract_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Client {
  id: string; // Use id for consistency
  client_id: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  cin_number: string;
  occupation: string;
  contracts: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Contract {
  id: string; // Use id for consistency
  contract_id: string;
  client_id: string;
  apartment_id: string;
  project_id: string;
  amount_dh: number; // Rent amount for rentals, sale price for sales
  type: 'rental' | 'sale';
  start_date: string; // Start date for rental, sale date for sale
  status: ContractStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;

  // Rental-specific fields
  duration_months?: number;
  end_date?: string;
  months_left?: number;
  previous_contract_id?: string;
  renewed_contract_id?: string;
}

export interface Payment {
    id: string; // Use id for consistency
    payment_id: string;
    contract_id: string;
    client_id: string;
    amount_dh: number;
    payment_date: string;
    payment_for: string; // Generic field for "October Rent", "Down Payment", etc.
    status: PaymentStatus;
    receipt_url?: string;
    payment_method: PaymentMethod;
    cheque_number?: string;
    bank_name?: string;
    transfer_series?: string;
    effect_number?: string;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    updated_by?: string;
}

export interface PermissionSet {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export interface AppPermissions {
    dashboard: PermissionSet; // Added dashboard permission
    projects: PermissionSet;
    apartments: PermissionSet;
    clients: PermissionSet;
    contracts: PermissionSet;
    payments: PermissionSet;
    settings: PermissionSet; // Access to settings page
}

export interface User {
    id: string;
    user_id: string;
    name: string;
    email: string;
    password?: string; // Stored for this template (should be secured in real app)
    role: 'admin' | 'agent';
    permissions: AppPermissions;
    avatar_url: string;
    last_login: string;
    created_at?: string;
}

export interface ReceiptData {
    payment: Payment;
    client: Client;
    contract: Contract;
    apartment: Apartment;
    project: Project;
}
