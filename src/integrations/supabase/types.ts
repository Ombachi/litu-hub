export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_question_cache: {
        Row: {
          assessment_category: string
          cache_key: string
          course_id: string | null
          created_at: string
          difficulty: string
          hit_count: number
          last_used_at: string
          payload: Json
          question_count: number
          topic: string
        }
        Insert: {
          assessment_category?: string
          cache_key: string
          course_id?: string | null
          created_at?: string
          difficulty: string
          hit_count?: number
          last_used_at?: string
          payload: Json
          question_count?: number
          topic: string
        }
        Update: {
          assessment_category?: string
          cache_key?: string
          course_id?: string | null
          created_at?: string
          difficulty?: string
          hit_count?: number
          last_used_at?: string
          payload?: Json
          question_count?: number
          topic?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          day: string
          function_name: string
          id: string
          last_request_at: string
          request_count: number
          tokens: number
          user_id: string
        }
        Insert: {
          day?: string
          function_name: string
          id?: string
          last_request_at?: string
          request_count?: number
          tokens?: number
          user_id: string
        }
        Update: {
          day?: string
          function_name?: string
          id?: string
          last_request_at?: string
          request_count?: number
          tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string | null
          content: string
          course_id: string
          created_at: string
          id: string
          pinned: boolean | null
          title: string
        }
        Insert: {
          author_id?: string | null
          content?: string
          course_id: string
          created_at?: string
          id?: string
          pinned?: boolean | null
          title: string
        }
        Update: {
          author_id?: string | null
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          pinned?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          content: string | null
          feedback: string | null
          file_url: string | null
          id: string
          score: number | null
          status: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late_submissions: boolean | null
          course_id: string
          created_at: string
          description: string | null
          due_date: string | null
          grace_period_hours: number | null
          id: string
          late_penalty_percent: number | null
          max_score: number
          rubric_criteria: Json | null
          title: string
          type: string
        }
        Insert: {
          allow_late_submissions?: boolean | null
          course_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          grace_period_hours?: number | null
          id?: string
          late_penalty_percent?: number | null
          max_score?: number
          rubric_criteria?: Json | null
          title: string
          type?: string
        }
        Update: {
          allow_late_submissions?: boolean | null
          course_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          grace_period_hours?: number | null
          id?: string
          late_penalty_percent?: number | null
          max_score?: number
          rubric_criteria?: Json | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      course_resources: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_tas: {
        Row: {
          course_id: string
          created_at: string
          id: string
          ta_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          ta_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          ta_id?: string
        }
        Relationships: []
      }
      course_tutors: {
        Row: {
          course_id: string
          created_at: string
          id: string
          tutor_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          tutor_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_tutors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          institution_id: string | null
          term_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          institution_id?: string | null
          term_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          institution_id?: string | null
          term_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      discussion_posts: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          discussion_id: string
          id: string
          likes: number | null
          parent_post_id: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          discussion_id: string
          id?: string
          likes?: number | null
          parent_post_id?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          discussion_id?: string
          id?: string
          likes?: number | null
          parent_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_posts_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_posts_parent_post_id_fkey"
            columns: ["parent_post_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      discussions: {
        Row: {
          author_id: string | null
          course_id: string
          created_at: string
          due_date: string | null
          id: string
          pinned: boolean | null
          title: string
        }
        Insert: {
          author_id?: string | null
          course_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          pinned?: boolean | null
          title: string
        }
        Update: {
          author_id?: string | null
          course_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          pinned?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_log: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          next_retry_at: string | null
          payment_id: string | null
          recipient_address: string
          recipient_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          payment_id?: string | null
          recipient_address: string
          recipient_user_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          payment_id?: string | null
          recipient_address?: string
          recipient_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_log_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_requests: {
        Row: {
          course_id: string
          id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_email: string
          student_id: string | null
        }
        Insert: {
          course_id: string
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_email?: string
          student_id?: string | null
        }
        Update: {
          course_id?: string
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_email?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          active: boolean
          amount_cents: number
          course_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          id: string
          institution_id: string
          name: string
          term_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          institution_id: string
          name: string
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          institution_id?: string
          name?: string
          term_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gdpr_deletion_requests: {
        Row: {
          completed_at: string | null
          details: Json | null
          email: string
          id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json | null
          email: string
          id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          details?: Json | null
          email?: string
          id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      institution_subscriptions: {
        Row: {
          auto_renew: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          institution_id: string
          plan_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          institution_id: string
          plan_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          institution_id?: string
          plan_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          slug: string
          tagline: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          tagline?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          tagline?: string | null
          website?: string | null
        }
        Relationships: []
      }
      invoice_installments: {
        Row: {
          amount_cents: number
          created_at: string
          due_date: string
          id: string
          invoice_id: string
          paid_at: string | null
          paid_cents: number
          sequence: number
        }
        Insert: {
          amount_cents: number
          created_at?: string
          due_date: string
          id?: string
          invoice_id: string
          paid_at?: string | null
          paid_cents?: number
          sequence: number
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_date?: string
          id?: string
          invoice_id?: string
          paid_at?: string | null
          paid_cents?: number
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_installments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bursary_cents: number
          bursary_label: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_cents: number
          discount_label: string | null
          due_date: string | null
          fee_structure_id: string | null
          id: string
          institution_id: string
          issued_at: string
          paid_cents: number
          reference: string
          scholarship_cents: number
          scholarship_label: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          subtotal_cents: number
          tax_cents: number
          tax_rate_bps: number
          term_id: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          bursary_cents?: number
          bursary_label?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_cents?: number
          discount_label?: string | null
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          institution_id: string
          issued_at?: string
          paid_cents?: number
          reference: string
          scholarship_cents?: number
          scholarship_label?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_bps?: number
          term_id?: string | null
          total_cents: number
          updated_at?: string
        }
        Update: {
          bursary_cents?: number
          bursary_label?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_cents?: number
          discount_label?: string | null
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          institution_id?: string
          issued_at?: string
          paid_cents?: number
          reference?: string
          scholarship_cents?: number
          scholarship_label?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_bps?: number
          term_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          student_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          student_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          completed: boolean | null
          content: string | null
          created_at: string
          duration: string | null
          id: string
          module_id: string
          order: number
          title: string
          type: string
        }
        Insert: {
          completed?: boolean | null
          content?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          module_id: string
          order?: number
          title: string
          type?: string
        }
        Update: {
          completed?: boolean | null
          content?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          module_id?: string
          order?: number
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          order: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_student_links: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          parent_id: string
          status: string
          student_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          parent_id: string
          status?: string
          student_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          parent_id?: string
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          invoice_id: string
          notes: string | null
          payer_id: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_reference: string | null
          raw_payload: Json | null
          receipt_number: string | null
          receipt_url: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payer_id?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_reference?: string | null
          raw_payload?: Json | null
          receipt_number?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payer_id?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_reference?: string | null
          raw_payload?: Json | null
          receipt_number?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          completed_at: string | null
          id: string
          quiz_id: string
          score: number | null
          started_at: string
          status: string
          student_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          quiz_id: string
          score?: number | null
          started_at?: string
          status?: string
          student_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          quiz_id?: string
          score?: number | null
          started_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          competency_tag: string
          correct_answer: string
          difficulty: string
          explanation: string | null
          id: string
          options: Json | null
          order: number
          points: number
          pool_name: string
          question_text: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          competency_tag?: string
          correct_answer?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json | null
          order?: number
          points?: number
          pool_name?: string
          question_text: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          competency_tag?: string
          correct_answer?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json | null
          order?: number
          points?: number
          pool_name?: string
          question_text?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          attempt_id: string
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string
          response: string
        }
        Insert: {
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id: string
          response?: string
        }
        Update: {
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          assessment_category: string
          course_id: string
          created_at: string
          description: string | null
          due_date: string | null
          exam_period: string
          id: string
          max_attempts: number
          time_limit: number
          title: string
        }
        Insert: {
          assessment_category?: string
          course_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          exam_period?: string
          id?: string
          max_attempts?: number
          time_limit?: number
          title: string
        }
        Update: {
          assessment_category?: string
          course_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          exam_period?: string
          id?: string
          max_attempts?: number
          time_limit?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payment_id: string
          processed_at: string | null
          scheduled_for: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payment_id: string
          processed_at?: string | null
          scheduled_for?: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payment_id?: string
          processed_at?: string | null
          scheduled_for?: string
          status?: string
        }
        Relationships: []
      }
      student_fee_overrides: {
        Row: {
          blocked: boolean
          grace_until: string | null
          id: string
          reason: string | null
          set_by: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          grace_until?: string | null
          id?: string
          reason?: string | null
          set_by?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          grace_until?: string | null
          id?: string
          reason?: string | null
          set_by?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          institution_id: string
          paid_at: string | null
          payer_id: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string | null
          provider: string
          provider_reference: string | null
          raw_payload: Json | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          institution_id: string
          paid_at?: string | null
          payer_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          provider: string
          provider_reference?: string | null
          raw_payload?: Json | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          institution_id?: string
          paid_at?: string | null
          payer_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          provider?: string
          provider_reference?: string | null
          raw_payload?: Json | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "institution_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          billing_period: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          max_students: number | null
          name: string
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          max_students?: number | null
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          max_students?: number | null
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      terms: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      user_institutions: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_institutions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          id: string
          payload: Json | null
          payment_id: string | null
          provider: string
          received_at: string
        }
        Insert: {
          event_id: string
          id?: string
          payload?: Json | null
          payment_id?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          payload?: Json | null
          payment_id?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          first_name: string | null
          last_name: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          first_name?: string | null
          last_name?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          first_name?: string | null
          last_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_payment_to_invoice: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      approve_parent_link: { Args: { _link_id: string }; Returns: undefined }
      can_access_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      can_message_user: { Args: { _recipient: string }; Returns: boolean }
      claim_payment_for_receipt: {
        Args: { _claim_token: string; _payment_id: string }
        Returns: boolean
      }
      cleanup_old_notifications: { Args: never; Returns: number }
      create_bulk_notifications: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _type?: string
          _user_ids: string[]
        }
        Returns: number
      }
      expire_stale_quiz_attempts: { Args: never; Returns: undefined }
      gdpr_delete_user_account: { Args: never; Returns: Json }
      gdpr_export_user_data: { Args: never; Returns: Json }
      get_admin_analytics_summary: {
        Args: { _institution_id?: string }
        Returns: Json
      }
      get_admin_course_stats: {
        Args: { _institution_id?: string }
        Returns: {
          assignments: number
          avg_score: number
          code: string
          course_id: string
          quiz_avg: number
          students: number
          submission_rate: number
          submissions: number
          term_name: string
          title: string
        }[]
      }
      get_admin_grade_distribution: {
        Args: { _institution_id?: string }
        Returns: {
          count: number
          range: string
        }[]
      }
      get_admin_submission_timeline: {
        Args: { _institution_id?: string }
        Returns: {
          count: number
          day: string
        }[]
      }
      get_fee_status: {
        Args: { _student_id: string }
        Returns: Database["public"]["Enums"]["fee_status"]
      }
      get_parent_link_audit: { Args: { _link_id: string }; Returns: Json }
      get_public_profiles: {
        Args: { _user_ids: string[] }
        Returns: {
          avatar_url: string
          first_name: string
          last_name: string
          user_id: string
        }[]
      }
      get_quiz_questions_for_student: {
        Args: { _quiz_id: string }
        Returns: {
          competency_tag: string
          correct_answer: string
          difficulty: string
          explanation: string
          id: string
          options: Json
          order: number
          points: number
          pool_name: string
          question_text: string
          question_type: string
          quiz_id: string
        }[]
      }
      get_student_analytics_summary: {
        Args: { _student_id: string }
        Returns: Json
      }
      get_student_course_breakdown: {
        Args: { _student_id: string }
        Returns: {
          avg_score: number
          code: string
          completed_lessons: number
          course_id: string
          progress_pct: number
          submitted_assignments: number
          title: string
          total_assignments: number
          total_lessons: number
        }[]
      }
      get_student_quiz_history: {
        Args: { _limit?: number; _student_id: string }
        Returns: {
          attempt_id: string
          completed_at: string
          quiz_title: string
          score: number
        }[]
      }
      get_tutor_course_summary: { Args: { _course_id: string }; Returns: Json }
      get_tutor_courses: {
        Args: { _tutor_id: string }
        Returns: {
          code: string
          course_id: string
          title: string
        }[]
      }
      get_tutor_grade_distribution: {
        Args: { _course_id: string }
        Returns: {
          count: number
          range: string
        }[]
      }
      get_tutor_student_performance: {
        Args: { _course_id: string }
        Returns: {
          at_risk: boolean
          avg_assignment: number
          avg_quiz: number
          email: string
          full_name: string
          lesson_pct: number
          overall_avg: number
          student_id: string
          submission_rate: number
        }[]
      }
      get_user_institution_id: { Args: { _user_id: string }; Returns: string }
      has_active_subscription: {
        Args: { _institution_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_course_tutor: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_school_admin_of: {
        Args: { _institution_id: string; _user_id: string }
        Returns: boolean
      }
      is_tutor_or_ta: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      list_pending_parent_links: {
        Args: never
        Returns: {
          created_at: string
          link_id: string
          parent_email: string
          parent_first_name: string
          parent_id: string
          parent_last_name: string
          status: string
          student_email: string
          student_first_name: string
          student_id: string
          student_last_name: string
        }[]
      }
      mark_direct_message_read: {
        Args: { _message_id: string }
        Returns: undefined
      }
      notify_saq_graded: {
        Args: { _attempt_id: string; _points_earned: number }
        Returns: undefined
      }
      notify_student_and_parents: {
        Args: {
          _link: string
          _message: string
          _student_id: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _link: string
          _message: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      recompute_fee_status_for_institution: {
        Args: { _institution_id: string }
        Returns: number
      }
      record_ai_usage: {
        Args: {
          _daily_limit?: number
          _function_name: string
          _per_minute_limit?: number
          _user_id: string
        }
        Returns: Json
      }
      refresh_invoice_statuses: { Args: never; Returns: undefined }
      reject_parent_link: { Args: { _link_id: string }; Returns: undefined }
      request_parent_link_by_email: {
        Args: { _student_email: string }
        Returns: string
      }
      sanitize_html: { Args: { input: string }; Returns: string }
      school_admin_can_access_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      search_messageable_users: {
        Args: { _limit?: number; _query: string }
        Returns: {
          avatar_url: string
          first_name: string
          last_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      submit_quiz_attempt: {
        Args: { _attempt_id: string; _responses: Json }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "tutor"
        | "student"
        | "platform_admin"
        | "school_admin"
        | "ta"
        | "parent"
      fee_status: "none" | "paid" | "partial" | "grace" | "overdue" | "blocked"
      invoice_status:
        | "draft"
        | "issued"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      payment_provider:
        | "mpesa"
        | "flutterwave"
        | "paystack"
        | "bank_transfer"
        | "cash"
        | "manual"
      payment_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "refunded"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "tutor",
        "student",
        "platform_admin",
        "school_admin",
        "ta",
        "parent",
      ],
      fee_status: ["none", "paid", "partial", "grace", "overdue", "blocked"],
      invoice_status: [
        "draft",
        "issued",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      payment_provider: [
        "mpesa",
        "flutterwave",
        "paystack",
        "bank_transfer",
        "cash",
        "manual",
      ],
      payment_status: [
        "pending",
        "succeeded",
        "failed",
        "refunded",
        "cancelled",
      ],
    },
  },
} as const
