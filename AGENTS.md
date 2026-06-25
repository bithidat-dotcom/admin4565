# Pbazar Partner System Connection Rules

This document defines the rules and shared data schema for the Pbazar Partner ecosystem. All applications interacting with the Pbazar product database must adhere to these standards.

## 1. Environment & Database
- Database: Firestore
- Collection: `products`
- Primary Key: Document ID (auto-generated)

## 2. Shared Data Schema (Products)
When adding a product, the following fields are MANDATORY for proper integration:

```json
{
  "name": "Product Name",
  "price": 5000,
  "discount": 10,
  "is_super_sale": true,
  "category": "Electronics",
  "seller": "Store Display Name",
  "seller_id": "unique_username",
  "seller_whatsapp": "017...",
  "seller_logo": "https://...",
  "stock": 20,
  "created_at": "ISO-TIMESTAMP"
}
```

## 3. Field Definitions
- **is_super_sale**: (Boolean) Set to `true` to show the product in the high-impact "HOT DEAL" section of the main website.
- **discount**: (Number) Percentage discount value (e.g., `10` for 10% off).
- **seller_id**: (String) Unique username or ID assigned to the partner.
- **created_at**: (String/Timestamp) ISO format date string.
