```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      forms: {
        Row: {
          created_at: string
          definition: Json | null
          id: string
          is_active: boolean | null
          name: string
          owner_id: string | null
          premise_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_id?: string | null
          premise_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string | null
          premise_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_premise_id_fkey"
            columns: ["premise_id"]
            isOneToOne: false
            referencedRelation: "premises"
            referencedColumns: ["id"]
          }
        ]
      }
      premises: {
        Row: {
          address: string | null
          category: string | null
          contact_person: string | null
          county: string | null
          created_at: string | null
          email: string
          friendly_code: string | null
          id: string
          name: string
          owner_id: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          county?: string | null
          created_at?: string | null
          email: string
          friendly_code?: string | null
          id?: string
          name: string
          owner_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          county?: string | null
          created_at?: string | null
          email?: string
          friendly_code?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premises_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null // Added based on previous context
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      qrcodes: {
        Row: {
          created_at: string
          form_id: string | null
          id: string
          is_active: boolean | null
          owner_id: string | null
          premise_id: string | null
          qr_identifier: string
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          form_id?: string | null
          id?: string
          is_active?: boolean | null
          owner_id?: string | null
          premise_id?: string | null
          qr_identifier: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          form_id?: string | null
          id?: string
          is_active?: boolean | null
          owner_id?: string | null
          premise_id?: string | null
          qr_identifier?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qrcodes_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrcodes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrcodes_premise_id_fkey"
            columns: ["premise_id"]
            isOneToOne: false
            referencedRelation: "premises"
            referencedColumns: ["id"]
          }
        ]
      }
      visits: {
        Row: {
          address: string | null
          check_in_time: string
          check_out_time: string | null
          created_at: string
          email: string | null
          form_data: Json | null
          form_id: string | null
          full_name: string | null
          id: string
          id_number: string | null
          phone_number: string | null
          premise_id: string | null
          qrcode_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          email?: string | null
          form_data?: Json | null
          form_id?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          phone_number?: string | null
          premise_id?: string | null
          qrcode_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          email?: string | null
          form_data?: Json | null
          form_id?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          phone_number?: string | null
          premise_id?: string | null
          qrcode_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_premise_id_fkey"
            columns: ["premise_id"]
            isOneToOne: false
            referencedRelation: "premises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_qrcode_id_fkey"
            columns: ["qrcode_id"]
            isOneToOne: false
            referencedRelation: "qrcodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_user_id_fkey" // Assuming this should link to auth.users
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "profiles" // Ensure this table exists and is named 'profiles'
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
```
