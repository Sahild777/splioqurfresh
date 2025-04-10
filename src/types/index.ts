export interface MenuItem {
  name: string;
  path: string;
  icon?: string;
  badge?: string;
  subMenu?: MenuItem[];
}

export interface Bar {
  id: number;
  name: string;
  address?: string;
}

export interface Party {
  id: string;
  name: string;
  address: string;
}

export interface Brand {
  itemCode: string;
  name: string;
  size: string;
  category: string;
  mrp?: number;
}

export interface TPEntry {
  srNo: number;
  tpNo: string;
  partyName: string;
  date: string;
  items: TPItem[];
}

export interface TPItem {
  srNo: number;
  brand: string;
  size: string;
  mrp: number;
  qtyCase: number;
  qtyBottle: number;
}

export interface Sale {
  date: string;
  items: SaleItem[];
  totalBottles: number;
  totalAmount: number;
}

export interface SaleItem {
  srNo: number;
  itemCode: string;
  brandName: string;
  size: string;
  qtyCase: number;
  qtyBottle: number;
  mrp: number;
}