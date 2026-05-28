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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          access_result: string | null
          action: string
          after_data: Json | null
          before_data: Json | null
          candidate_id: string | null
          created_at: string
          device_info: string | null
          exam_id: string | null
          id: string
          import_session_id: string | null
          ip_address: string | null
          module: string | null
          permission_key: string | null
          reason: string | null
          record_id: string | null
          user_id: string | null
        }
        Insert: {
          access_result?: string | null
          action: string
          after_data?: Json | null
          before_data?: Json | null
          candidate_id?: string | null
          created_at?: string
          device_info?: string | null
          exam_id?: string | null
          id?: string
          import_session_id?: string | null
          ip_address?: string | null
          module?: string | null
          permission_key?: string | null
          reason?: string | null
          record_id?: string | null
          user_id?: string | null
        }
        Update: {
          access_result?: string | null
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          candidate_id?: string | null
          created_at?: string
          device_info?: string | null
          exam_id?: string | null
          id?: string
          import_session_id?: string | null
          ip_address?: string | null
          module?: string | null
          permission_key?: string | null
          reason?: string | null
          record_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bmi_rules: {
        Row: {
          classification: string
          created_at: string
          id: string
          label: string | null
          max_value: number | null
          min_value: number | null
          rule_set_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          classification: string
          created_at?: string
          id?: string
          label?: string | null
          max_value?: number | null
          min_value?: number | null
          rule_set_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          classification?: string
          created_at?: string
          id?: string
          label?: string | null
          max_value?: number | null
          min_value?: number | null
          rule_set_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bmi_rules_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "formula_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      bypass_audit: {
        Row: {
          bypass_type: string
          candidate_id: string | null
          created_at: string
          exam_id: string | null
          id: string
          metadata: Json
          reason: string
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          section_key: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bypass_type: string
          candidate_id?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          metadata?: Json
          reason: string
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section_key?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bypass_type?: string
          candidate_id?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          metadata?: Json
          reason?: string
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section_key?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidate_merge_logs: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          created_at: string
          duplicate_candidate_id: string
          id: string
          merge_reason: string | null
          merged_at: string
          merged_by: string | null
          primary_candidate_id: string
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          duplicate_candidate_id: string
          id?: string
          merge_reason?: string | null
          merged_at?: string
          merged_by?: string | null
          primary_candidate_id: string
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          duplicate_candidate_id?: string
          id?: string
          merge_reason?: string | null
          merged_at?: string
          merged_by?: string | null
          primary_candidate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_merge_logs_duplicate_candidate_id_fkey"
            columns: ["duplicate_candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_merge_logs_primary_candidate_id_fkey"
            columns: ["primary_candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_test_number_history: {
        Row: {
          candidate_id: string
          change_type: string
          changed_at: string
          changed_by: string | null
          id: string
          new_temporary_id: string | null
          new_test_number: string | null
          old_temporary_id: string | null
          old_test_number: string | null
          reason: string | null
        }
        Insert: {
          candidate_id: string
          change_type: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_temporary_id?: string | null
          new_test_number?: string | null
          old_temporary_id?: string | null
          old_test_number?: string | null
          reason?: string | null
        }
        Update: {
          candidate_id?: string
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_temporary_id?: string | null
          new_test_number?: string | null
          old_temporary_id?: string | null
          old_test_number?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      candidates: {
        Row: {
          address: string | null
          age_text: string | null
          bag_number: string | null
          birth_date: string | null
          birth_place: string | null
          class_group: string | null
          combined_identity: string | null
          corps: string | null
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          dikma_diktuk: string | null
          full_name: string
          gender: string | null
          generation: string | null
          group_name: string | null
          id: string
          linked_user_id: string | null
          nrp_nip: string | null
          panda: string | null
          phone: string | null
          pnd_code: string | null
          pok_korp: string | null
          rank: string | null
          registration_notes: string | null
          selection_id: string
          serial_number: number | null
          sort_order: number | null
          source_import_session_id: string | null
          status: string
          temporary_id: string | null
          test_number: string | null
          test_number_assigned_at: string | null
          test_number_assigned_by: string | null
          test_number_notes: string | null
          test_number_status: string
          tmt_jabatan: string | null
          unit_position: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          age_text?: string | null
          bag_number?: string | null
          birth_date?: string | null
          birth_place?: string | null
          class_group?: string | null
          combined_identity?: string | null
          corps?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dikma_diktuk?: string | null
          full_name: string
          gender?: string | null
          generation?: string | null
          group_name?: string | null
          id?: string
          linked_user_id?: string | null
          nrp_nip?: string | null
          panda?: string | null
          phone?: string | null
          pnd_code?: string | null
          pok_korp?: string | null
          rank?: string | null
          registration_notes?: string | null
          selection_id: string
          serial_number?: number | null
          sort_order?: number | null
          source_import_session_id?: string | null
          status?: string
          temporary_id?: string | null
          test_number?: string | null
          test_number_assigned_at?: string | null
          test_number_assigned_by?: string | null
          test_number_notes?: string | null
          test_number_status?: string
          tmt_jabatan?: string | null
          unit_position?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          age_text?: string | null
          bag_number?: string | null
          birth_date?: string | null
          birth_place?: string | null
          class_group?: string | null
          combined_identity?: string | null
          corps?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dikma_diktuk?: string | null
          full_name?: string
          gender?: string | null
          generation?: string | null
          group_name?: string | null
          id?: string
          linked_user_id?: string | null
          nrp_nip?: string | null
          panda?: string | null
          phone?: string | null
          pnd_code?: string | null
          pok_korp?: string | null
          rank?: string | null
          registration_notes?: string | null
          selection_id?: string
          serial_number?: number | null
          sort_order?: number | null
          source_import_session_id?: string | null
          status?: string
          temporary_id?: string | null
          test_number?: string | null
          test_number_assigned_at?: string | null
          test_number_assigned_by?: string | null
          test_number_notes?: string | null
          test_number_status?: string
          tmt_jabatan?: string | null
          unit_position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "selections"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_ranks: {
        Row: {
          classification: string
          color_key: string | null
          created_at: string
          id: string
          is_failure_level: boolean
          label: string | null
          rank_value: number
          rule_set_id: string
          updated_at: string
        }
        Insert: {
          classification: string
          color_key?: string | null
          created_at?: string
          id?: string
          is_failure_level?: boolean
          label?: string | null
          rank_value: number
          rule_set_id: string
          updated_at?: string
        }
        Update: {
          classification?: string
          color_key?: string | null
          created_at?: string
          id?: string
          is_failure_level?: boolean
          label?: string | null
          rank_value?: number
          rule_set_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_ranks_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "formula_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      data_quality_checks: {
        Row: {
          candidate_id: string | null
          created_at: string
          description: string | null
          exam_id: string | null
          id: string
          issue_level: string
          issue_type: string
          resolved_at: string | null
          resolved_by: string | null
          section_key: string | null
          selection_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          exam_id?: string | null
          id?: string
          issue_level?: string
          issue_type: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_key?: string | null
          selection_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          exam_id?: string | null
          id?: string
          issue_level?: string
          issue_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_key?: string | null
          selection_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dental_tooth_records: {
        Row: {
          created_at: string
          exam_dental_id: string
          id: string
          markers_json: Json
          notes: string | null
          tooth_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_dental_id: string
          id?: string
          markers_json?: Json
          notes?: string | null
          tooth_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_dental_id?: string
          id?: string
          markers_json?: Json
          notes?: string | null
          tooth_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dental_tooth_records_exam_dental_id_fkey"
            columns: ["exam_dental_id"]
            isOneToOne: false
            referencedRelation: "exam_dental"
            referencedColumns: ["id"]
          },
        ]
      }
      document_exports: {
        Row: {
          candidate_id: string | null
          created_at: string
          document_type: string
          error_message: string | null
          exam_id: string | null
          export_type: string
          exported_at: string
          exported_by: string | null
          file_name: string | null
          file_url: string | null
          filter_json: Json | null
          generated_from_blanko: boolean
          id: string
          is_draft: boolean
          is_finalized: boolean
          section_key: string | null
          selection_id: string | null
          status: string
          template_type: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          document_type: string
          error_message?: string | null
          exam_id?: string | null
          export_type: string
          exported_at?: string
          exported_by?: string | null
          file_name?: string | null
          file_url?: string | null
          filter_json?: Json | null
          generated_from_blanko?: boolean
          id?: string
          is_draft?: boolean
          is_finalized?: boolean
          section_key?: string | null
          selection_id?: string | null
          status?: string
          template_type?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          document_type?: string
          error_message?: string | null
          exam_id?: string | null
          export_type?: string
          exported_at?: string
          exported_by?: string | null
          file_name?: string | null
          file_url?: string | null
          filter_json?: Json | null
          generated_from_blanko?: boolean
          id?: string
          is_draft?: boolean
          is_finalized?: boolean
          section_key?: string | null
          selection_id?: string | null
          status?: string
          template_type?: string | null
        }
        Relationships: []
      }
      exam_cardiology: {
        Row: {
          attachments_json: Json
          candidate_id: string
          conclusion: string | null
          created_at: string
          exam_id: string
          examination: string | null
          examination_type: string | null
          examined_at: string | null
          examined_on: string | null
          examiner_id: string | null
          id: string
          qualification_u: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attachments_json?: Json
          candidate_id: string
          conclusion?: string | null
          created_at?: string
          exam_id: string
          examination?: string | null
          examination_type?: string | null
          examined_at?: string | null
          examined_on?: string | null
          examiner_id?: string | null
          id?: string
          qualification_u?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attachments_json?: Json
          candidate_id?: string
          conclusion?: string | null
          created_at?: string
          exam_id?: string
          examination?: string | null
          examination_type?: string | null
          examined_at?: string | null
          examined_on?: string | null
          examiner_id?: string | null
          id?: string
          qualification_u?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_dental: {
        Row: {
          candidate_id: string
          classification: string | null
          conclusion: string | null
          created_at: string
          dental_abnormality: string | null
          dmf: number | null
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          id: string
          jaw_abnormality: string | null
          occlusion_contact_count: number | null
          oral_abnormality: string | null
          oral_hygiene: string | null
          qualification_g: string | null
          status: string
          updated_at: string
          vital_teeth_count: number | null
        }
        Insert: {
          candidate_id: string
          classification?: string | null
          conclusion?: string | null
          created_at?: string
          dental_abnormality?: string | null
          dmf?: number | null
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          jaw_abnormality?: string | null
          occlusion_contact_count?: number | null
          oral_abnormality?: string | null
          oral_hygiene?: string | null
          qualification_g?: string | null
          status?: string
          updated_at?: string
          vital_teeth_count?: number | null
        }
        Update: {
          candidate_id?: string
          classification?: string | null
          conclusion?: string | null
          created_at?: string
          dental_abnormality?: string | null
          dmf?: number | null
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          jaw_abnormality?: string | null
          occlusion_contact_count?: number | null
          oral_abnormality?: string | null
          oral_hygiene?: string | null
          qualification_g?: string | null
          status?: string
          updated_at?: string
          vital_teeth_count?: number | null
        }
        Relationships: []
      }
      exam_ent: {
        Row: {
          candidate_id: string
          conclusion: string | null
          created_at: string
          ear_left: string | null
          ear_right: string | null
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          hearing_notes: string | null
          id: string
          larynx: string | null
          nose: string | null
          qualification_u: string | null
          status: string
          throat: string | null
          updated_at: string
          whisper_ad: string | null
          whisper_as: string | null
        }
        Insert: {
          candidate_id: string
          conclusion?: string | null
          created_at?: string
          ear_left?: string | null
          ear_right?: string | null
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          hearing_notes?: string | null
          id?: string
          larynx?: string | null
          nose?: string | null
          qualification_u?: string | null
          status?: string
          throat?: string | null
          updated_at?: string
          whisper_ad?: string | null
          whisper_as?: string | null
        }
        Update: {
          candidate_id?: string
          conclusion?: string | null
          created_at?: string
          ear_left?: string | null
          ear_right?: string | null
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          hearing_notes?: string | null
          id?: string
          larynx?: string | null
          nose?: string | null
          qualification_u?: string | null
          status?: string
          throat?: string | null
          updated_at?: string
          whisper_ad?: string | null
          whisper_as?: string | null
        }
        Relationships: []
      }
      exam_eye: {
        Row: {
          busur_percentage: string | null
          candidate_id: string
          color_blindness: string | null
          conclusion: string | null
          contact_lens: string | null
          contact_lens_notes: string | null
          created_at: string
          dp_od: string | null
          dp_os: string | null
          ekso_foria_od: string | null
          ekso_foria_os: string | null
          eso_foria_od: string | null
          eso_foria_os: string | null
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          id: string
          other_notes: string | null
          qualification_l: string | null
          qualification_u: string | null
          status: string
          updated_at: string
          vertical_foria_od: string | null
          vertical_foria_os: string | null
          visus_od: string | null
          visus_os: string | null
        }
        Insert: {
          busur_percentage?: string | null
          candidate_id: string
          color_blindness?: string | null
          conclusion?: string | null
          contact_lens?: string | null
          contact_lens_notes?: string | null
          created_at?: string
          dp_od?: string | null
          dp_os?: string | null
          ekso_foria_od?: string | null
          ekso_foria_os?: string | null
          eso_foria_od?: string | null
          eso_foria_os?: string | null
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          other_notes?: string | null
          qualification_l?: string | null
          qualification_u?: string | null
          status?: string
          updated_at?: string
          vertical_foria_od?: string | null
          vertical_foria_os?: string | null
          visus_od?: string | null
          visus_os?: string | null
        }
        Update: {
          busur_percentage?: string | null
          candidate_id?: string
          color_blindness?: string | null
          conclusion?: string | null
          contact_lens?: string | null
          contact_lens_notes?: string | null
          created_at?: string
          dp_od?: string | null
          dp_os?: string | null
          ekso_foria_od?: string | null
          ekso_foria_os?: string | null
          eso_foria_od?: string | null
          eso_foria_os?: string | null
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          other_notes?: string | null
          qualification_l?: string | null
          qualification_u?: string | null
          status?: string
          updated_at?: string
          vertical_foria_od?: string | null
          vertical_foria_os?: string | null
          visus_od?: string | null
          visus_os?: string | null
        }
        Relationships: []
      }
      exam_eye_vision: {
        Row: {
          candidate_id: string
          color_perception: string | null
          conclusion: string | null
          created_at: string
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          field_of_vision: string | null
          id: string
          qualification_l: string | null
          refraction_od: string | null
          refraction_os: string | null
          status: string
          stereopsis: string | null
          updated_at: string
          visus_corrected_od: string | null
          visus_corrected_os: string | null
          visus_od: string | null
          visus_os: string | null
        }
        Insert: {
          candidate_id: string
          color_perception?: string | null
          conclusion?: string | null
          created_at?: string
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          field_of_vision?: string | null
          id?: string
          qualification_l?: string | null
          refraction_od?: string | null
          refraction_os?: string | null
          status?: string
          stereopsis?: string | null
          updated_at?: string
          visus_corrected_od?: string | null
          visus_corrected_os?: string | null
          visus_od?: string | null
          visus_os?: string | null
        }
        Update: {
          candidate_id?: string
          color_perception?: string | null
          conclusion?: string | null
          created_at?: string
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          field_of_vision?: string | null
          id?: string
          qualification_l?: string | null
          refraction_od?: string | null
          refraction_os?: string | null
          status?: string
          stereopsis?: string | null
          updated_at?: string
          visus_corrected_od?: string | null
          visus_corrected_os?: string | null
          visus_od?: string | null
          visus_os?: string | null
        }
        Relationships: []
      }
      exam_general: {
        Row: {
          anamnesis: string | null
          candidate_id: string
          chest_expiration_cm: number | null
          chest_inspiration_cm: number | null
          conclusion: string | null
          created_at: string
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          height_cm: number | null
          id: string
          leg_length_cm: number | null
          qualification_u: string | null
          screening_classification: string | null
          status: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          anamnesis?: string | null
          candidate_id: string
          chest_expiration_cm?: number | null
          chest_inspiration_cm?: number | null
          conclusion?: string | null
          created_at?: string
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          height_cm?: number | null
          id?: string
          leg_length_cm?: number | null
          qualification_u?: string | null
          screening_classification?: string | null
          status?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          anamnesis?: string | null
          candidate_id?: string
          chest_expiration_cm?: number | null
          chest_inspiration_cm?: number | null
          conclusion?: string | null
          created_at?: string
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          height_cm?: number | null
          id?: string
          leg_length_cm?: number | null
          qualification_u?: string | null
          screening_classification?: string | null
          status?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      exam_internal_medicine: {
        Row: {
          abdomen: string | null
          blood_pressure: string | null
          candidate_id: string
          conclusion: string | null
          created_at: string
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          heart: string | null
          id: string
          lung: string | null
          pulse: string | null
          qualification_u: string | null
          status: string
          updated_at: string
        }
        Insert: {
          abdomen?: string | null
          blood_pressure?: string | null
          candidate_id: string
          conclusion?: string | null
          created_at?: string
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          heart?: string | null
          id?: string
          lung?: string | null
          pulse?: string | null
          qualification_u?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          abdomen?: string | null
          blood_pressure?: string | null
          candidate_id?: string
          conclusion?: string | null
          created_at?: string
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          heart?: string | null
          id?: string
          lung?: string | null
          pulse?: string | null
          qualification_u?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_lab: {
        Row: {
          asam_urat: string | null
          attachments_json: Json
          candidate_id: string
          conclusion: string | null
          created_at: string
          diff_basofil: string | null
          diff_eosinofil: string | null
          diff_limfosit: string | null
          diff_monosit: string | null
          diff_neutrofil: string | null
          eritrosit: string | null
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          gula_darah_2jpp: string | null
          gula_darah_puasa: string | null
          hb: string | null
          hba1c: string | null
          hdl: string | null
          hematokrit: string | null
          id: string
          kolesterol_total: string | null
          kreatinin: string | null
          ldl: string | null
          led: string | null
          leukosit: string | null
          narkoba_amfetamin: string | null
          narkoba_benzo: string | null
          narkoba_kesimpulan: string | null
          narkoba_kokain: string | null
          narkoba_metamfetamin: string | null
          narkoba_opiat: string | null
          narkoba_thc: string | null
          qualification_u: string | null
          sgot: string | null
          sgpt: string | null
          status: string
          trigliserida: string | null
          trombosit: string | null
          updated_at: string
          ureum: string | null
          urin_bilirubin: string | null
          urin_bj: string | null
          urin_darah: string | null
          urin_glukosa: string | null
          urin_kejernihan: string | null
          urin_keton: string | null
          urin_leukosit: string | null
          urin_nitrit: string | null
          urin_ph: string | null
          urin_protein: string | null
          urin_sedimen: string | null
          urin_warna: string | null
        }
        Insert: {
          asam_urat?: string | null
          attachments_json?: Json
          candidate_id: string
          conclusion?: string | null
          created_at?: string
          diff_basofil?: string | null
          diff_eosinofil?: string | null
          diff_limfosit?: string | null
          diff_monosit?: string | null
          diff_neutrofil?: string | null
          eritrosit?: string | null
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          gula_darah_2jpp?: string | null
          gula_darah_puasa?: string | null
          hb?: string | null
          hba1c?: string | null
          hdl?: string | null
          hematokrit?: string | null
          id?: string
          kolesterol_total?: string | null
          kreatinin?: string | null
          ldl?: string | null
          led?: string | null
          leukosit?: string | null
          narkoba_amfetamin?: string | null
          narkoba_benzo?: string | null
          narkoba_kesimpulan?: string | null
          narkoba_kokain?: string | null
          narkoba_metamfetamin?: string | null
          narkoba_opiat?: string | null
          narkoba_thc?: string | null
          qualification_u?: string | null
          sgot?: string | null
          sgpt?: string | null
          status?: string
          trigliserida?: string | null
          trombosit?: string | null
          updated_at?: string
          ureum?: string | null
          urin_bilirubin?: string | null
          urin_bj?: string | null
          urin_darah?: string | null
          urin_glukosa?: string | null
          urin_kejernihan?: string | null
          urin_keton?: string | null
          urin_leukosit?: string | null
          urin_nitrit?: string | null
          urin_ph?: string | null
          urin_protein?: string | null
          urin_sedimen?: string | null
          urin_warna?: string | null
        }
        Update: {
          asam_urat?: string | null
          attachments_json?: Json
          candidate_id?: string
          conclusion?: string | null
          created_at?: string
          diff_basofil?: string | null
          diff_eosinofil?: string | null
          diff_limfosit?: string | null
          diff_monosit?: string | null
          diff_neutrofil?: string | null
          eritrosit?: string | null
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          gula_darah_2jpp?: string | null
          gula_darah_puasa?: string | null
          hb?: string | null
          hba1c?: string | null
          hdl?: string | null
          hematokrit?: string | null
          id?: string
          kolesterol_total?: string | null
          kreatinin?: string | null
          ldl?: string | null
          led?: string | null
          leukosit?: string | null
          narkoba_amfetamin?: string | null
          narkoba_benzo?: string | null
          narkoba_kesimpulan?: string | null
          narkoba_kokain?: string | null
          narkoba_metamfetamin?: string | null
          narkoba_opiat?: string | null
          narkoba_thc?: string | null
          qualification_u?: string | null
          sgot?: string | null
          sgpt?: string | null
          status?: string
          trigliserida?: string | null
          trombosit?: string | null
          updated_at?: string
          ureum?: string | null
          urin_bilirubin?: string | null
          urin_bj?: string | null
          urin_darah?: string | null
          urin_glukosa?: string | null
          urin_kejernihan?: string | null
          urin_keton?: string | null
          urin_leukosit?: string | null
          urin_nitrit?: string | null
          urin_ph?: string | null
          urin_protein?: string | null
          urin_sedimen?: string | null
          urin_warna?: string | null
        }
        Relationships: []
      }
      exam_neurology: {
        Row: {
          autonomic: string | null
          candidate_id: string
          conclusion: string | null
          consciousness: string | null
          coordination: string | null
          cranial_nerves: string | null
          created_at: string
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          id: string
          is_optional: boolean
          motoric: string | null
          qualification_u: string | null
          reflexes: string | null
          sensoric: string | null
          status: string
          updated_at: string
        }
        Insert: {
          autonomic?: string | null
          candidate_id: string
          conclusion?: string | null
          consciousness?: string | null
          coordination?: string | null
          cranial_nerves?: string | null
          created_at?: string
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          is_optional?: boolean
          motoric?: string | null
          qualification_u?: string | null
          reflexes?: string | null
          sensoric?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          autonomic?: string | null
          candidate_id?: string
          conclusion?: string | null
          consciousness?: string | null
          coordination?: string | null
          cranial_nerves?: string | null
          created_at?: string
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          is_optional?: boolean
          motoric?: string | null
          qualification_u?: string | null
          reflexes?: string | null
          sensoric?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_psychology: {
        Row: {
          anamnesa: string | null
          attachments_json: Json
          candidate_id: string
          catatan_observasi: string | null
          classification: string | null
          conclusion: string | null
          created_at: string
          emosi: string | null
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          id: string
          kecerdasan: string | null
          kepribadian: string | null
          keswa_affect: string | null
          keswa_anamnesis_other: string | null
          keswa_anamnesis_preschool: string | null
          keswa_anamnesis_school: string | null
          keswa_appearance_neatness: string | null
          keswa_attitude: string | null
          keswa_behavior: string | null
          keswa_classification: string | null
          keswa_conclusion: string | null
          keswa_diagnosis: string | null
          keswa_emotion_control: string | null
          keswa_emotion_stability: string | null
          keswa_legacy_notes: string | null
          keswa_memory: string | null
          keswa_opinion_ability: string | null
          keswa_orientation: string | null
          keswa_other_symptoms: string[] | null
          keswa_perception_disorder: string | null
          keswa_result_status: string | null
          keswa_speech: string | null
          keswa_stakes: string | null
          keswa_thought_process_content: string | null
          keswa_thought_process_quality: string | null
          motivasi: string | null
          qualification_u: string | null
          sikap_kerja: string | null
          status: string
          updated_at: string
        }
        Insert: {
          anamnesa?: string | null
          attachments_json?: Json
          candidate_id: string
          catatan_observasi?: string | null
          classification?: string | null
          conclusion?: string | null
          created_at?: string
          emosi?: string | null
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          kecerdasan?: string | null
          kepribadian?: string | null
          keswa_affect?: string | null
          keswa_anamnesis_other?: string | null
          keswa_anamnesis_preschool?: string | null
          keswa_anamnesis_school?: string | null
          keswa_appearance_neatness?: string | null
          keswa_attitude?: string | null
          keswa_behavior?: string | null
          keswa_classification?: string | null
          keswa_conclusion?: string | null
          keswa_diagnosis?: string | null
          keswa_emotion_control?: string | null
          keswa_emotion_stability?: string | null
          keswa_legacy_notes?: string | null
          keswa_memory?: string | null
          keswa_opinion_ability?: string | null
          keswa_orientation?: string | null
          keswa_other_symptoms?: string[] | null
          keswa_perception_disorder?: string | null
          keswa_result_status?: string | null
          keswa_speech?: string | null
          keswa_stakes?: string | null
          keswa_thought_process_content?: string | null
          keswa_thought_process_quality?: string | null
          motivasi?: string | null
          qualification_u?: string | null
          sikap_kerja?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          anamnesa?: string | null
          attachments_json?: Json
          candidate_id?: string
          catatan_observasi?: string | null
          classification?: string | null
          conclusion?: string | null
          created_at?: string
          emosi?: string | null
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          kecerdasan?: string | null
          kepribadian?: string | null
          keswa_affect?: string | null
          keswa_anamnesis_other?: string | null
          keswa_anamnesis_preschool?: string | null
          keswa_anamnesis_school?: string | null
          keswa_appearance_neatness?: string | null
          keswa_attitude?: string | null
          keswa_behavior?: string | null
          keswa_classification?: string | null
          keswa_conclusion?: string | null
          keswa_diagnosis?: string | null
          keswa_emotion_control?: string | null
          keswa_emotion_stability?: string | null
          keswa_legacy_notes?: string | null
          keswa_memory?: string | null
          keswa_opinion_ability?: string | null
          keswa_orientation?: string | null
          keswa_other_symptoms?: string[] | null
          keswa_perception_disorder?: string | null
          keswa_result_status?: string | null
          keswa_speech?: string | null
          keswa_stakes?: string | null
          keswa_thought_process_content?: string | null
          keswa_thought_process_quality?: string | null
          motivasi?: string | null
          qualification_u?: string | null
          sikap_kerja?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_radiology: {
        Row: {
          attachments_json: Json
          candidate_id: string
          conclusion: string | null
          created_at: string
          exam_id: string
          examination: string | null
          examination_type: string | null
          examined_at: string | null
          examined_on: string | null
          examiner_id: string | null
          id: string
          qualification_u: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attachments_json?: Json
          candidate_id: string
          conclusion?: string | null
          created_at?: string
          exam_id: string
          examination?: string | null
          examination_type?: string | null
          examined_at?: string | null
          examined_on?: string | null
          examiner_id?: string | null
          id?: string
          qualification_u?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attachments_json?: Json
          candidate_id?: string
          conclusion?: string | null
          created_at?: string
          exam_id?: string
          examination?: string | null
          examination_type?: string | null
          examined_at?: string | null
          examined_on?: string | null
          examiner_id?: string | null
          id?: string
          qualification_u?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_sections: {
        Row: {
          anamnesis_status: string | null
          approved_at: string | null
          approved_by: string | null
          assigned_role: string | null
          bypass_at: string | null
          bypass_by: string | null
          bypass_reason: string | null
          bypass_reviewed_at: string | null
          bypass_reviewed_by: string | null
          candidate_id: string
          classification: string | null
          clear_at: string | null
          clear_by: string | null
          clear_note: string | null
          created_at: string
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          findings: string | null
          form_data_json: Json
          id: string
          locked_at: string | null
          notes: string | null
          printable_template_key: string | null
          qualification_json: Json
          revision_reason: string | null
          revision_requested_at: string | null
          revision_requested_by: string | null
          section_key: string
          section_name: string
          section_status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          anamnesis_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_role?: string | null
          bypass_at?: string | null
          bypass_by?: string | null
          bypass_reason?: string | null
          bypass_reviewed_at?: string | null
          bypass_reviewed_by?: string | null
          candidate_id: string
          classification?: string | null
          clear_at?: string | null
          clear_by?: string | null
          clear_note?: string | null
          created_at?: string
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          findings?: string | null
          form_data_json?: Json
          id?: string
          locked_at?: string | null
          notes?: string | null
          printable_template_key?: string | null
          qualification_json?: Json
          revision_reason?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          section_key: string
          section_name: string
          section_status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          anamnesis_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_role?: string | null
          bypass_at?: string | null
          bypass_by?: string | null
          bypass_reason?: string | null
          bypass_reviewed_at?: string | null
          bypass_reviewed_by?: string | null
          candidate_id?: string
          classification?: string | null
          clear_at?: string | null
          clear_by?: string | null
          clear_note?: string | null
          created_at?: string
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          findings?: string | null
          form_data_json?: Json
          id?: string
          locked_at?: string | null
          notes?: string | null
          printable_template_key?: string | null
          qualification_json?: Json
          revision_reason?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          section_key?: string
          section_name?: string
          section_status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sections_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sections_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_surgery: {
        Row: {
          candidate_id: string
          conclusion: string | null
          created_at: string
          exam_id: string
          examined_at: string | null
          examiner_id: string | null
          general_condition: string | null
          id: string
          inguinal: string | null
          lower_extremity: string | null
          other_notes: string | null
          posture: string | null
          qualification_u: string | null
          spine: string | null
          status: string
          updated_at: string
          upper_extremity: string | null
        }
        Insert: {
          candidate_id: string
          conclusion?: string | null
          created_at?: string
          exam_id: string
          examined_at?: string | null
          examiner_id?: string | null
          general_condition?: string | null
          id?: string
          inguinal?: string | null
          lower_extremity?: string | null
          other_notes?: string | null
          posture?: string | null
          qualification_u?: string | null
          spine?: string | null
          status?: string
          updated_at?: string
          upper_extremity?: string | null
        }
        Update: {
          candidate_id?: string
          conclusion?: string | null
          created_at?: string
          exam_id?: string
          examined_at?: string | null
          examiner_id?: string | null
          general_condition?: string | null
          id?: string
          inguinal?: string | null
          lower_extremity?: string | null
          other_notes?: string | null
          posture?: string | null
          qualification_u?: string | null
          spine?: string | null
          status?: string
          updated_at?: string
          upper_extremity?: string | null
        }
        Relationships: []
      }
      exam_usg: {
        Row: {
          candidate_id: string
          conclusion: string | null
          created_at: string
          exam_id: string
          examination: string | null
          examined_at: string | null
          examiner_id: string | null
          id: string
          qualification_u: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          conclusion?: string | null
          created_at?: string
          exam_id: string
          examination?: string | null
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          qualification_u?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          conclusion?: string | null
          created_at?: string
          exam_id?: string
          examination?: string | null
          examined_at?: string | null
          examiner_id?: string | null
          id?: string
          qualification_u?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          bypass_initial_at: string | null
          bypass_initial_by: string | null
          bypass_initial_reason: string | null
          bypass_initial_reviewed_at: string | null
          bypass_initial_reviewed_by: string | null
          candidate_id: string
          created_at: string
          ekg_initial_status: string
          exam_status: string
          final_result: string | null
          final_score: number | null
          finalized_at: string | null
          finalized_by: string | null
          formula_rule_set_id: string | null
          formula_rule_set_version: number | null
          hari_h_stage: string | null
          id: string
          initial_supporting_completed_at: string | null
          kesum_classification: string | null
          keswa_status: string | null
          last_calculated_at: string | null
          last_calculated_by: string | null
          progress_completed_count: number
          progress_detail_json: Json
          progress_last_calculated_at: string | null
          progress_percentage: number
          progress_total_count: number
          radiology_initial_status: string
          selection_id: string
          source_import_session_id: string | null
          unlock_reason: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
        }
        Insert: {
          bypass_initial_at?: string | null
          bypass_initial_by?: string | null
          bypass_initial_reason?: string | null
          bypass_initial_reviewed_at?: string | null
          bypass_initial_reviewed_by?: string | null
          candidate_id: string
          created_at?: string
          ekg_initial_status?: string
          exam_status?: string
          final_result?: string | null
          final_score?: number | null
          finalized_at?: string | null
          finalized_by?: string | null
          formula_rule_set_id?: string | null
          formula_rule_set_version?: number | null
          hari_h_stage?: string | null
          id?: string
          initial_supporting_completed_at?: string | null
          kesum_classification?: string | null
          keswa_status?: string | null
          last_calculated_at?: string | null
          last_calculated_by?: string | null
          progress_completed_count?: number
          progress_detail_json?: Json
          progress_last_calculated_at?: string | null
          progress_percentage?: number
          progress_total_count?: number
          radiology_initial_status?: string
          selection_id: string
          source_import_session_id?: string | null
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Update: {
          bypass_initial_at?: string | null
          bypass_initial_by?: string | null
          bypass_initial_reason?: string | null
          bypass_initial_reviewed_at?: string | null
          bypass_initial_reviewed_by?: string | null
          candidate_id?: string
          created_at?: string
          ekg_initial_status?: string
          exam_status?: string
          final_result?: string | null
          final_score?: number | null
          finalized_at?: string | null
          finalized_by?: string | null
          formula_rule_set_id?: string | null
          formula_rule_set_version?: number | null
          hari_h_stage?: string | null
          id?: string
          initial_supporting_completed_at?: string | null
          kesum_classification?: string | null
          keswa_status?: string | null
          last_calculated_at?: string | null
          last_calculated_by?: string | null
          progress_completed_count?: number
          progress_detail_json?: Json
          progress_last_calculated_at?: string | null
          progress_percentage?: number
          progress_total_count?: number
          radiology_initial_status?: string
          selection_id?: string
          source_import_session_id?: string | null
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "selections"
            referencedColumns: ["id"]
          },
        ]
      }
      final_result_rules: {
        Row: {
          condition_json: Json | null
          condition_key: string
          created_at: string
          id: string
          priority_order: number
          result_value: string
          rule_set_id: string
          updated_at: string
        }
        Insert: {
          condition_json?: Json | null
          condition_key: string
          created_at?: string
          id?: string
          priority_order?: number
          result_value: string
          rule_set_id: string
          updated_at?: string
        }
        Update: {
          condition_json?: Json | null
          condition_key?: string
          created_at?: string
          id?: string
          priority_order?: number
          result_value?: string
          rule_set_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_result_rules_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "formula_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_rule_sets: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          archived_at: string | null
          archived_by: string | null
          based_on_rule_set_id: string | null
          config_json: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          is_default: boolean
          rule_set_name: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          archived_at?: string | null
          archived_by?: string | null
          based_on_rule_set_id?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_default?: boolean
          rule_set_name: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          archived_at?: string | null
          archived_by?: string | null
          based_on_rule_set_id?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_default?: boolean
          rule_set_name?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      formula_validation_cases: {
        Row: {
          actual_json: Json | null
          case_code: string
          case_name: string
          created_at: string
          created_by: string | null
          description: string | null
          expected_json: Json
          id: string
          input_json: Json
          last_result: string | null
          last_run_at: string | null
          last_run_by: string | null
          rule_set_id: string | null
          updated_at: string
        }
        Insert: {
          actual_json?: Json | null
          case_code: string
          case_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_json?: Json
          id?: string
          input_json?: Json
          last_result?: string | null
          last_run_at?: string | null
          last_run_by?: string | null
          rule_set_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_json?: Json | null
          case_code?: string
          case_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_json?: Json
          id?: string
          input_json?: Json
          last_result?: string | null
          last_run_at?: string | null
          last_run_by?: string | null
          rule_set_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      go_live_checklist_items: {
        Row: {
          category: string
          checklist_id: string
          created_at: string
          description: string | null
          evidence_url: string | null
          id: string
          is_critical: boolean
          item_name: string
          notes: string | null
          sort_order: number
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          category: string
          checklist_id: string
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          is_critical?: boolean
          item_name: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          category?: string
          checklist_id?: string
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          is_critical?: boolean
          item_name?: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "go_live_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "go_live_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      go_live_checklists: {
        Row: {
          checklist_name: string
          created_at: string
          created_by: string | null
          id: string
          selection_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checklist_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          selection_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checklist_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          selection_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      handover_packages: {
        Row: {
          checklist_json: Json
          created_at: string
          file_url: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          notes: string | null
          package_name: string
          selection_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checklist_json?: Json
          created_at?: string
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          notes?: string | null
          package_name: string
          selection_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checklist_json?: Json
          created_at?: string
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          notes?: string | null
          package_name?: string
          selection_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hari_h_settings: {
        Row: {
          allow_bypass_with_reason: boolean
          created_at: string
          id: string
          require_ekg_before_screening: boolean
          require_ekg_before_subteam: boolean
          require_radiology_before_screening: boolean
          require_radiology_before_subteam: boolean
          selection_id: string | null
          updated_at: string
        }
        Insert: {
          allow_bypass_with_reason?: boolean
          created_at?: string
          id?: string
          require_ekg_before_screening?: boolean
          require_ekg_before_subteam?: boolean
          require_radiology_before_screening?: boolean
          require_radiology_before_subteam?: boolean
          selection_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_bypass_with_reason?: boolean
          created_at?: string
          id?: string
          require_ekg_before_screening?: boolean
          require_ekg_before_subteam?: boolean
          require_radiology_before_screening?: boolean
          require_radiology_before_subteam?: boolean
          selection_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      help_article_feedback: {
        Row: {
          article_id: string
          created_at: string
          feedback_text: string | null
          id: string
          is_helpful: boolean
          user_id: string | null
        }
        Insert: {
          article_id: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          is_helpful: boolean
          user_id?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          is_helpful?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_article_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          category: string
          content_markdown: string
          created_at: string
          created_by: string | null
          helpful_count: number
          id: string
          not_helpful_count: number
          published_at: string | null
          role_visibility_json: Json
          slug: string
          status: string
          summary: string | null
          tags_json: Json
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          category: string
          content_markdown?: string
          created_at?: string
          created_by?: string | null
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          published_at?: string | null
          role_visibility_json?: Json
          slug: string
          status?: string
          summary?: string | null
          tags_json?: Json
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          category?: string
          content_markdown?: string
          created_at?: string
          created_by?: string | null
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          published_at?: string | null
          role_visibility_json?: Json
          slug?: string
          status?: string
          summary?: string | null
          tags_json?: Json
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      import_mapping_templates: {
        Row: {
          column_mapping_json: Json | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          row_pattern_json: Json | null
          sheet_mapping_json: Json | null
          updated_at: string
          workbook_type: string
        }
        Insert: {
          column_mapping_json?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          row_pattern_json?: Json | null
          sheet_mapping_json?: Json | null
          updated_at?: string
          workbook_type?: string
        }
        Update: {
          column_mapping_json?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          row_pattern_json?: Json | null
          sheet_mapping_json?: Json | null
          updated_at?: string
          workbook_type?: string
        }
        Relationships: []
      }
      import_session_rows: {
        Row: {
          action_taken: string | null
          before_data_json: Json | null
          candidate_id: string | null
          created_at: string
          error_messages_json: Json | null
          exam_id: string | null
          full_name: string | null
          id: string
          import_session_id: string
          mapped_data_json: Json | null
          raw_data_json: Json | null
          row_number: number | null
          row_status: string
          sheet_name: string | null
          test_number: string | null
          updated_at: string
          warning_messages_json: Json | null
        }
        Insert: {
          action_taken?: string | null
          before_data_json?: Json | null
          candidate_id?: string | null
          created_at?: string
          error_messages_json?: Json | null
          exam_id?: string | null
          full_name?: string | null
          id?: string
          import_session_id: string
          mapped_data_json?: Json | null
          raw_data_json?: Json | null
          row_number?: number | null
          row_status?: string
          sheet_name?: string | null
          test_number?: string | null
          updated_at?: string
          warning_messages_json?: Json | null
        }
        Update: {
          action_taken?: string | null
          before_data_json?: Json | null
          candidate_id?: string | null
          created_at?: string
          error_messages_json?: Json | null
          exam_id?: string | null
          full_name?: string | null
          id?: string
          import_session_id?: string
          mapped_data_json?: Json | null
          raw_data_json?: Json | null
          row_number?: number | null
          row_status?: string
          sheet_name?: string | null
          test_number?: string | null
          updated_at?: string
          warning_messages_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_session_rows_import_session_id_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sessions: {
        Row: {
          candidates_deleted: number
          completed_at: string | null
          created_at: string
          detected_sheets_json: Json | null
          error_message: string | null
          exams_deleted: number
          failed_rows: number
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          import_strategy: string
          import_type: string
          mapping_json: Json | null
          options_json: Json | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          rolled_back_reason: string | null
          selection_id: string | null
          skipped_rows: number
          started_at: string | null
          started_by: string | null
          status: string
          success_rows: number
          total_rows: number
          updated_at: string
          warning_rows: number
        }
        Insert: {
          candidates_deleted?: number
          completed_at?: string | null
          created_at?: string
          detected_sheets_json?: Json | null
          error_message?: string | null
          exams_deleted?: number
          failed_rows?: number
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          import_strategy?: string
          import_type?: string
          mapping_json?: Json | null
          options_json?: Json | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          rolled_back_reason?: string | null
          selection_id?: string | null
          skipped_rows?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          success_rows?: number
          total_rows?: number
          updated_at?: string
          warning_rows?: number
        }
        Update: {
          candidates_deleted?: number
          completed_at?: string | null
          created_at?: string
          detected_sheets_json?: Json | null
          error_message?: string | null
          exams_deleted?: number
          failed_rows?: number
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          import_strategy?: string
          import_type?: string
          mapping_json?: Json | null
          options_json?: Json | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          rolled_back_reason?: string | null
          selection_id?: string | null
          skipped_rows?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          success_rows?: number
          total_rows?: number
          updated_at?: string
          warning_rows?: number
        }
        Relationships: []
      }
      juknis_parameter_rules: {
        Row: {
          classification: string | null
          created_at: string
          gender: string | null
          id: string
          is_blocking: boolean
          max_value: number | null
          min_value: number | null
          notes: string | null
          parameter_key: string
          parameter_label: string | null
          rule_set_id: string | null
          selection_type: string | null
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          classification?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          is_blocking?: boolean
          max_value?: number | null
          min_value?: number | null
          notes?: string | null
          parameter_key: string
          parameter_label?: string | null
          rule_set_id?: string | null
          selection_type?: string | null
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          classification?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          is_blocking?: boolean
          max_value?: number | null
          min_value?: number | null
          notes?: string | null
          parameter_key?: string
          parameter_label?: string | null
          rule_set_id?: string | null
          selection_type?: string | null
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kesum_rule_configs: {
        Row: {
          created_at: string
          id: string
          is_included: boolean
          is_required: boolean
          rule_set_id: string
          section_key: string
          section_name: string | null
          sort_order: number
          updated_at: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_included?: boolean
          is_required?: boolean
          rule_set_id: string
          section_key: string
          section_name?: string | null
          sort_order?: number
          updated_at?: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_included?: boolean
          is_required?: boolean
          rule_set_id?: string
          section_key?: string
          section_name?: string | null
          sort_order?: number
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kesum_rule_configs_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "formula_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      keswa_rule_configs: {
        Row: {
          created_at: string
          fail_result: string
          failure_classification: string
          id: string
          incomplete_result: string
          pass_result: string
          rule_set_id: string
          source_section_key: string
          th_result: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fail_result?: string
          failure_classification?: string
          id?: string
          incomplete_result?: string
          pass_result?: string
          rule_set_id: string
          source_section_key?: string
          th_result?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fail_result?: string
          failure_classification?: string
          id?: string
          incomplete_result?: string
          pass_result?: string
          rule_set_id?: string
          source_section_key?: string
          th_result?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "keswa_rule_configs_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "formula_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_attachments: {
        Row: {
          attachment_type: string
          candidate_id: string
          caption: string | null
          created_at: string
          exam_id: string
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          section_key: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          attachment_type: string
          candidate_id: string
          caption?: string | null
          created_at?: string
          exam_id: string
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          section_key: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: string
          candidate_id?: string
          caption?: string | null
          created_at?: string
          exam_id?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          section_key?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      medical_history_forms: {
        Row: {
          anamnesis_workflow_status: string
          candidate_id: string
          candidate_signature_url: string | null
          candidate_signed_at: string | null
          clarification_note: string | null
          clarification_requested_at: string | null
          clarification_requested_by: string | null
          clarification_resolved_at: string | null
          clarification_resolved_by: string | null
          created_at: string
          created_by: string | null
          doctor_examiner_name: string | null
          doctor_notes_json: Json
          doctor_recommendation: string | null
          doctor_resume: string | null
          doctor_review_note: string | null
          doctor_review_status: string | null
          doctor_reviewed_at: string | null
          doctor_reviewed_by: string | null
          doctor_signature_url: string | null
          doctor_signed_at: string | null
          exam_id: string
          family_history_json: Json
          female_health_json: Json
          followup_questions_json: Json
          honesty_statement_accepted: boolean
          id: string
          identity_data_json: Json
          locked_at: string | null
          other_disease_notes: string | null
          patient_filled_at: string | null
          patient_filled_by: string | null
          patient_signature_url: string | null
          patient_signed_at: string | null
          patient_submitted_at: string | null
          patient_submitted_by: string | null
          personal_history_json: Json
          return_reason: string | null
          returned_to_draft_at: string | null
          returned_to_draft_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          updated_by: string | null
          work_history_json: Json
        }
        Insert: {
          anamnesis_workflow_status?: string
          candidate_id: string
          candidate_signature_url?: string | null
          candidate_signed_at?: string | null
          clarification_note?: string | null
          clarification_requested_at?: string | null
          clarification_requested_by?: string | null
          clarification_resolved_at?: string | null
          clarification_resolved_by?: string | null
          created_at?: string
          created_by?: string | null
          doctor_examiner_name?: string | null
          doctor_notes_json?: Json
          doctor_recommendation?: string | null
          doctor_resume?: string | null
          doctor_review_note?: string | null
          doctor_review_status?: string | null
          doctor_reviewed_at?: string | null
          doctor_reviewed_by?: string | null
          doctor_signature_url?: string | null
          doctor_signed_at?: string | null
          exam_id: string
          family_history_json?: Json
          female_health_json?: Json
          followup_questions_json?: Json
          honesty_statement_accepted?: boolean
          id?: string
          identity_data_json?: Json
          locked_at?: string | null
          other_disease_notes?: string | null
          patient_filled_at?: string | null
          patient_filled_by?: string | null
          patient_signature_url?: string | null
          patient_signed_at?: string | null
          patient_submitted_at?: string | null
          patient_submitted_by?: string | null
          personal_history_json?: Json
          return_reason?: string | null
          returned_to_draft_at?: string | null
          returned_to_draft_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
          work_history_json?: Json
        }
        Update: {
          anamnesis_workflow_status?: string
          candidate_id?: string
          candidate_signature_url?: string | null
          candidate_signed_at?: string | null
          clarification_note?: string | null
          clarification_requested_at?: string | null
          clarification_requested_by?: string | null
          clarification_resolved_at?: string | null
          clarification_resolved_by?: string | null
          created_at?: string
          created_by?: string | null
          doctor_examiner_name?: string | null
          doctor_notes_json?: Json
          doctor_recommendation?: string | null
          doctor_resume?: string | null
          doctor_review_note?: string | null
          doctor_review_status?: string | null
          doctor_reviewed_at?: string | null
          doctor_reviewed_by?: string | null
          doctor_signature_url?: string | null
          doctor_signed_at?: string | null
          exam_id?: string
          family_history_json?: Json
          female_health_json?: Json
          followup_questions_json?: Json
          honesty_statement_accepted?: boolean
          id?: string
          identity_data_json?: Json
          locked_at?: string | null
          other_disease_notes?: string | null
          patient_filled_at?: string | null
          patient_filled_by?: string | null
          patient_signature_url?: string | null
          patient_signed_at?: string | null
          patient_submitted_at?: string | null
          patient_submitted_by?: string | null
          personal_history_json?: Json
          return_reason?: string | null
          returned_to_draft_at?: string | null
          returned_to_draft_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
          work_history_json?: Json
        }
        Relationships: []
      }
      medical_measurements: {
        Row: {
          bmi: number | null
          bmi_classification: string | null
          candidate_id: string
          chest_or_waist_lp: number | null
          created_at: string
          exam_id: string
          height_cm: number | null
          id: string
          max_ideal_weight: number | null
          min_ideal_weight: number | null
          updated_at: string
          weight_difference: number | null
          weight_kg: number | null
        }
        Insert: {
          bmi?: number | null
          bmi_classification?: string | null
          candidate_id: string
          chest_or_waist_lp?: number | null
          created_at?: string
          exam_id: string
          height_cm?: number | null
          id?: string
          max_ideal_weight?: number | null
          min_ideal_weight?: number | null
          updated_at?: string
          weight_difference?: number | null
          weight_kg?: number | null
        }
        Update: {
          bmi?: number | null
          bmi_classification?: string | null
          candidate_id?: string
          chest_or_waist_lp?: number | null
          created_at?: string
          exam_id?: string
          height_cm?: number | null
          id?: string
          max_ideal_weight?: number | null
          min_ideal_weight?: number | null
          updated_at?: string
          weight_difference?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_measurements_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_measurements_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: true
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_subteams: {
        Row: {
          created_at: string
          display_title: string
          doctor_name: string | null
          doctor_title: string | null
          id: string
          is_active: boolean
          location: string | null
          nrp: string | null
          rank: string | null
          responsible_role: string | null
          section_key: string
          section_name: string
          selection_id: string | null
          signature_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_title: string
          doctor_name?: string | null
          doctor_title?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          nrp?: string | null
          rank?: string | null
          responsible_role?: string | null
          section_key: string
          section_name: string
          selection_id?: string | null
          signature_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_title?: string
          doctor_name?: string | null
          doctor_title?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          nrp?: string | null
          rank?: string | null
          responsible_role?: string | null
          section_key?: string
          section_name?: string
          selection_id?: string | null
          signature_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medical_summary: {
        Row: {
          after_parade_result: string | null
          attention_notes: string | null
          candidate_id: string
          count_b: number
          count_c: number
          count_k1: number
          count_k2: number
          created_at: string
          exam_id: string
          final_result: string | null
          final_score: number | null
          id: string
          initial_result: string | null
          k1_notes: string | null
          k2_notes: string | null
          kesum_classification: string | null
          keswa_status: string | null
          parade_notes: string | null
          pra_pantukhir_result: string | null
          rakor_result: string | null
          suggestions: string | null
          updated_at: string
        }
        Insert: {
          after_parade_result?: string | null
          attention_notes?: string | null
          candidate_id: string
          count_b?: number
          count_c?: number
          count_k1?: number
          count_k2?: number
          created_at?: string
          exam_id: string
          final_result?: string | null
          final_score?: number | null
          id?: string
          initial_result?: string | null
          k1_notes?: string | null
          k2_notes?: string | null
          kesum_classification?: string | null
          keswa_status?: string | null
          parade_notes?: string | null
          pra_pantukhir_result?: string | null
          rakor_result?: string | null
          suggestions?: string | null
          updated_at?: string
        }
        Update: {
          after_parade_result?: string | null
          attention_notes?: string | null
          candidate_id?: string
          count_b?: number
          count_c?: number
          count_k1?: number
          count_k2?: number
          created_at?: string
          exam_id?: string
          final_result?: string | null
          final_score?: number | null
          id?: string
          initial_result?: string | null
          k1_notes?: string | null
          k2_notes?: string | null
          kesum_classification?: string | null
          keswa_status?: string | null
          parade_notes?: string | null
          pra_pantukhir_result?: string | null
          rakor_result?: string | null
          suggestions?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_summary_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_summary_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: true
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          candidate_id: string | null
          created_at: string
          exam_id: string | null
          id: string
          link_url: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          candidate_id?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          candidate_id?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      operation_checklist_items: {
        Row: {
          category: string
          checked_at: string | null
          checked_by: string | null
          checklist_id: string
          created_at: string
          id: string
          item_name: string
          notes: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          checked_at?: string | null
          checked_by?: string | null
          checklist_id: string
          created_at?: string
          id?: string
          item_name: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          checked_at?: string | null
          checked_by?: string | null
          checklist_id?: string
          created_at?: string
          id?: string
          item_name?: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "operation_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_checklists: {
        Row: {
          checklist_date: string
          checklist_type: string
          created_at: string
          created_by: string | null
          id: string
          selection_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checklist_date?: string
          checklist_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          selection_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checklist_date?: string
          checklist_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          selection_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_sections: Json | null
          assigned_subteams: Json | null
          auth_user_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          is_test_account: boolean
          nrp_nip: string | null
          rank: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          assigned_sections?: Json | null
          assigned_subteams?: Json | null
          auth_user_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          is_test_account?: boolean
          nrp_nip?: string | null
          rank?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          assigned_sections?: Json | null
          assigned_subteams?: Json | null
          auth_user_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_test_account?: boolean
          nrp_nip?: string | null
          rank?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      progress_weights: {
        Row: {
          category: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          category?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          weight: number
        }
        Update: {
          category?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: []
      }
      qa_issues: {
        Row: {
          actual_result: string | null
          assigned_to: string | null
          created_at: string
          description: string | null
          evidence_url: string | null
          expected_result: string | null
          id: string
          issue_code: string
          module: string | null
          priority: string
          related_candidate_id: string | null
          related_exam_id: string | null
          related_export_id: string | null
          related_test_run_id: string | null
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          root_cause: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          expected_result?: string | null
          id?: string
          issue_code: string
          module?: string | null
          priority?: string
          related_candidate_id?: string | null
          related_exam_id?: string | null
          related_export_id?: string | null
          related_test_run_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          expected_result?: string | null
          id?: string
          issue_code?: string
          module?: string | null
          priority?: string
          related_candidate_id?: string | null
          related_exam_id?: string | null
          related_export_id?: string | null
          related_test_run_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_issues_related_test_run_id_fkey"
            columns: ["related_test_run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_cases: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expected_result: string | null
          feature: string | null
          id: string
          module: string
          precondition: string | null
          priority: string
          status: string
          steps_json: Json
          test_case_code: string
          test_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_result?: string | null
          feature?: string | null
          id?: string
          module: string
          precondition?: string | null
          priority?: string
          status?: string
          steps_json?: Json
          test_case_code: string
          test_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_result?: string | null
          feature?: string | null
          id?: string
          module?: string
          precondition?: string | null
          priority?: string
          status?: string
          steps_json?: Json
          test_case_code?: string
          test_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      qa_test_pack_items: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          test_case_id: string
          test_pack_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          test_case_id: string
          test_pack_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          test_case_id?: string
          test_pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_pack_items_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "qa_test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_test_pack_items_test_pack_id_fkey"
            columns: ["test_pack_id"]
            isOneToOne: false
            referencedRelation: "qa_test_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_packs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          module: string | null
          pack_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module?: string | null
          pack_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module?: string | null
          pack_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      qa_test_runs: {
        Row: {
          actual_result: string | null
          created_at: string
          evidence_url: string | null
          id: string
          linked_issue_id: string | null
          notes: string | null
          result: string
          run_at: string
          run_by: string | null
          test_case_id: string
          uat_session_id: string | null
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          linked_issue_id?: string | null
          notes?: string | null
          result?: string
          run_at?: string
          run_by?: string | null
          test_case_id: string
          uat_session_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          linked_issue_id?: string | null
          notes?: string | null
          result?: string
          run_at?: string
          run_by?: string | null
          test_case_id?: string
          uat_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_runs_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "qa_test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_test_runs_uat_session_id_fkey"
            columns: ["uat_session_id"]
            isOneToOne: false
            referencedRelation: "uat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      release_notes: {
        Row: {
          changes_json: Json
          created_at: string
          id: string
          known_issues_json: Json
          published_at: string | null
          published_by: string | null
          release_date: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          changes_json?: Json
          created_at?: string
          id?: string
          known_issues_json?: Json
          published_at?: string | null
          published_by?: string | null
          release_date?: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          changes_json?: Json
          created_at?: string
          id?: string
          known_issues_json?: Json
          published_at?: string | null
          published_by?: string | null
          release_date?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      review_marks: {
        Row: {
          candidate_id: string
          created_at: string
          exam_id: string | null
          id: string
          marked_by: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          exam_id?: string | null
          id?: string
          marked_by: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          exam_id?: string | null
          id?: string
          marked_by?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rikkes_form_sections: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          candidate_id: string
          created_at: string
          created_by: string | null
          exam_id: string
          form_data_json: Json
          group_key: string
          id: string
          locked_at: string | null
          return_reason: string | null
          returned_to_draft_at: string | null
          returned_to_draft_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          candidate_id: string
          created_at?: string
          created_by?: string | null
          exam_id: string
          form_data_json?: Json
          group_key: string
          id?: string
          locked_at?: string | null
          return_reason?: string | null
          returned_to_draft_at?: string | null
          returned_to_draft_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          exam_id?: string
          form_data_json?: Json
          group_key?: string
          id?: string
          locked_at?: string | null
          return_reason?: string | null
          returned_to_draft_at?: string | null
          returned_to_draft_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          filter_json: Json
          filter_name: string
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_json?: Json
          filter_name: string
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_json?: Json
          filter_name?: string
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          applies_to_final_result: string | null
          base_score: number
          created_at: string
          id: string
          kesum_classification: string
          maximum_score: number | null
          minimum_score: number | null
          penalty_c: number
          penalty_k1: number
          penalty_k2: number
          penalty_th: number
          rule_set_id: string
          updated_at: string
        }
        Insert: {
          applies_to_final_result?: string | null
          base_score?: number
          created_at?: string
          id?: string
          kesum_classification: string
          maximum_score?: number | null
          minimum_score?: number | null
          penalty_c?: number
          penalty_k1?: number
          penalty_k2?: number
          penalty_th?: number
          rule_set_id: string
          updated_at?: string
        }
        Update: {
          applies_to_final_result?: string | null
          base_score?: number
          created_at?: string
          id?: string
          kesum_classification?: string
          maximum_score?: number | null
          minimum_score?: number | null
          penalty_c?: number
          penalty_k1?: number
          penalty_k2?: number
          penalty_th?: number
          rule_set_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "formula_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_signoffs: {
        Row: {
          candidate_id: string
          created_at: string
          exam_id: string
          id: string
          officer_id: string | null
          officer_name: string | null
          section_key: string
          section_name: string | null
          signature_url: string | null
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          exam_id: string
          id?: string
          officer_id?: string | null
          officer_name?: string | null
          section_key: string
          section_name?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          exam_id?: string
          id?: string
          officer_id?: string | null
          officer_name?: string | null
          section_key?: string
          section_name?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      selections: {
        Row: {
          active_formula_rule_set_id: string | null
          active_pdf_template_id: string | null
          active_report_template_id: string | null
          active_xlsx_template_id: string | null
          created_at: string
          end_date: string | null
          id: string
          institution_header_line_1: string
          institution_header_line_2: string
          is_default: boolean
          location: string | null
          name: string
          participant_label: string
          report_subtitle: string | null
          report_title: string
          start_date: string | null
          status: string
          updated_at: string
          year_label: string
        }
        Insert: {
          active_formula_rule_set_id?: string | null
          active_pdf_template_id?: string | null
          active_report_template_id?: string | null
          active_xlsx_template_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          institution_header_line_1?: string
          institution_header_line_2?: string
          is_default?: boolean
          location?: string | null
          name: string
          participant_label?: string
          report_subtitle?: string | null
          report_title?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          year_label: string
        }
        Update: {
          active_formula_rule_set_id?: string | null
          active_pdf_template_id?: string | null
          active_report_template_id?: string | null
          active_xlsx_template_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          institution_header_line_1?: string
          institution_header_line_2?: string
          is_default?: boolean
          location?: string | null
          name?: string
          participant_label?: string
          report_subtitle?: string | null
          report_title?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          year_label?: string
        }
        Relationships: []
      }
      sop_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string
          checklist_json: Json
          created_at: string
          created_by: string | null
          effective_date: string | null
          expected_output: string | null
          id: string
          objective: string | null
          prerequisites: string | null
          procedure_markdown: string
          role_visibility_json: Json
          scope: string | null
          security_notes: string | null
          sop_code: string
          status: string
          title: string
          troubleshooting: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category: string
          checklist_json?: Json
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          expected_output?: string | null
          id?: string
          objective?: string | null
          prerequisites?: string | null
          procedure_markdown?: string
          role_visibility_json?: Json
          scope?: string | null
          security_notes?: string | null
          sop_code: string
          status?: string
          title: string
          troubleshooting?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          checklist_json?: Json
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          expected_output?: string | null
          id?: string
          objective?: string | null
          prerequisites?: string | null
          procedure_markdown?: string
          role_visibility_json?: Json
          scope?: string | null
          security_notes?: string | null
          sop_code?: string
          status?: string
          title?: string
          troubleshooting?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      stakes_configs: {
        Row: {
          calculation_mode: string
          created_at: string
          id: string
          is_enabled: boolean
          rule_set_id: string
          sort_order: number
          source_section_keys_json: Json | null
          stakes_key: string
          stakes_label: string | null
          updated_at: string
        }
        Insert: {
          calculation_mode?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          rule_set_id: string
          sort_order?: number
          source_section_keys_json?: Json | null
          stakes_key: string
          stakes_label?: string | null
          updated_at?: string
        }
        Update: {
          calculation_mode?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          rule_set_id?: string
          sort_order?: number
          source_section_keys_json?: Json | null
          stakes_key?: string
          stakes_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakes_configs_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "formula_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      test_number_import_rows: {
        Row: {
          candidate_id: string | null
          created_at: string
          error_messages_json: Json | null
          exam_id: string | null
          id: string
          mapped_data_json: Json | null
          match_confidence: string | null
          new_test_number: string | null
          old_test_number: string | null
          raw_data_json: Json | null
          row_status: string
          session_id: string
          source_row_number: number | null
          warning_messages_json: Json | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          error_messages_json?: Json | null
          exam_id?: string | null
          id?: string
          mapped_data_json?: Json | null
          match_confidence?: string | null
          new_test_number?: string | null
          old_test_number?: string | null
          raw_data_json?: Json | null
          row_status?: string
          session_id: string
          source_row_number?: number | null
          warning_messages_json?: Json | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          error_messages_json?: Json | null
          exam_id?: string | null
          id?: string
          mapped_data_json?: Json | null
          match_confidence?: string | null
          new_test_number?: string | null
          old_test_number?: string | null
          raw_data_json?: Json | null
          row_status?: string
          session_id?: string
          source_row_number?: number | null
          warning_messages_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "test_number_import_rows_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_number_import_rows_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_number_import_rows_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "test_number_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_number_import_sessions: {
        Row: {
          ambiguous_rows: number | null
          completed_at: string | null
          created_at: string
          error_rows: number | null
          file_name: string
          file_type: string | null
          id: string
          matched_rows: number | null
          not_found_rows: number | null
          options_json: Json | null
          selection_id: string | null
          skipped_rows: number | null
          source_format: string | null
          started_at: string | null
          started_by: string | null
          status: string
          total_rows: number | null
          updated_at: string
          updated_rows: number | null
        }
        Insert: {
          ambiguous_rows?: number | null
          completed_at?: string | null
          created_at?: string
          error_rows?: number | null
          file_name: string
          file_type?: string | null
          id?: string
          matched_rows?: number | null
          not_found_rows?: number | null
          options_json?: Json | null
          selection_id?: string | null
          skipped_rows?: number | null
          source_format?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          total_rows?: number | null
          updated_at?: string
          updated_rows?: number | null
        }
        Update: {
          ambiguous_rows?: number | null
          completed_at?: string | null
          created_at?: string
          error_rows?: number | null
          file_name?: string
          file_type?: string | null
          id?: string
          matched_rows?: number | null
          not_found_rows?: number | null
          options_json?: Json | null
          selection_id?: string | null
          skipped_rows?: number | null
          source_format?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          total_rows?: number | null
          updated_at?: string
          updated_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_number_import_sessions_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "selections"
            referencedColumns: ["id"]
          },
        ]
      }
      uat_feedback: {
        Row: {
          converted_issue_id: string | null
          created_at: string
          feedback_text: string
          feedback_type: string
          id: string
          module: string | null
          role: string | null
          severity: string
          status: string
          uat_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          converted_issue_id?: string | null
          created_at?: string
          feedback_text: string
          feedback_type?: string
          id?: string
          module?: string | null
          role?: string | null
          severity?: string
          status?: string
          uat_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          converted_issue_id?: string | null
          created_at?: string
          feedback_text?: string
          feedback_type?: string
          id?: string
          module?: string | null
          role?: string | null
          severity?: string
          status?: string
          uat_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uat_feedback_converted_issue_id_fkey"
            columns: ["converted_issue_id"]
            isOneToOne: false
            referencedRelation: "qa_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uat_feedback_uat_session_id_fkey"
            columns: ["uat_session_id"]
            isOneToOne: false
            referencedRelation: "uat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      uat_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          scope_json: Json
          selection_id: string | null
          session_name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          scope_json?: Json
          selection_id?: string | null
          session_name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          scope_json?: Json
          selection_id?: string | null
          session_name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      uat_signoffs: {
        Row: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          role: string
          signed_at: string
          signed_by: string
          signoff_scope: string | null
          uat_session_id: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          notes?: string | null
          role: string
          signed_at?: string
          signed_by: string
          signoff_scope?: string | null
          uat_session_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          role?: string
          signed_at?: string
          signed_by?: string
          signoff_scope?: string | null
          uat_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uat_signoffs_uat_session_id_fkey"
            columns: ["uat_session_id"]
            isOneToOne: false
            referencedRelation: "uat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      unlock_logs: {
        Row: {
          candidate_id: string
          created_at: string
          exam_id: string
          id: string
          reason: string
          relocked_at: string | null
          section_keys: Json | null
          status: string
          unlock_scope: string
          unlocked_at: string
          unlocked_by: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          exam_id: string
          id?: string
          reason: string
          relocked_at?: string | null
          section_keys?: Json | null
          status?: string
          unlock_scope?: string
          unlocked_at?: string
          unlocked_by: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          exam_id?: string
          id?: string
          reason?: string
          relocked_at?: string | null
          section_keys?: Json | null
          status?: string
          unlock_scope?: string
          unlocked_at?: string
          unlocked_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_acknowledgements: {
        Row: {
          acknowledged_at: string
          acknowledgement_text: string | null
          created_at: string
          document_code: string | null
          document_id: string | null
          document_type: string
          id: string
          quiz_score: number | null
          user_id: string
          version: number | null
        }
        Insert: {
          acknowledged_at?: string
          acknowledgement_text?: string | null
          created_at?: string
          document_code?: string | null
          document_id?: string | null
          document_type: string
          id?: string
          quiz_score?: number | null
          user_id: string
          version?: number | null
        }
        Update: {
          acknowledged_at?: string
          acknowledgement_text?: string | null
          created_at?: string
          document_code?: string | null
          document_id?: string | null
          document_type?: string
          id?: string
          quiz_score?: number | null
          user_id?: string
          version?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_section_assignments: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_export: boolean
          can_request_revision: boolean
          can_submit: boolean
          can_update: boolean
          can_upload: boolean
          can_view: boolean
          created_at: string
          id: string
          is_active: boolean
          section_key: string
          section_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_export?: boolean
          can_request_revision?: boolean
          can_submit?: boolean
          can_update?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          section_key: string
          section_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_export?: boolean
          can_request_revision?: boolean
          can_submit?: boolean
          can_update?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          section_key?: string
          section_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_training_progress: {
        Row: {
          acknowledgement_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          lesson_key: string | null
          module_key: string
          progress_percentage: number
          quiz_score: number | null
          role: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledgement_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_key?: string | null
          module_key: string
          progress_percentage?: number
          quiz_score?: number | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledgement_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_key?: string | null
          module_key?: string
          progress_percentage?: number
          quiz_score?: number | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_rikkes_group: {
        Args: { _group_key: string; _user_id: string }
        Returns: boolean
      }
      compute_exam_progress: { Args: { p_exam_id: string }; Returns: undefined }
      delete_personnel_cascade: {
        Args: { _candidate_id: string; _reason: string }
        Returns: Json
      }
      get_progress_weight: {
        Args: { _default: number; _key: string }
        Returns: number
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_anamnesis_patient_writable: {
        Args: { _workflow_status: string }
        Returns: boolean
      }
      is_general_writer: { Args: { _user_id: string }; Returns: boolean }
      is_internal_staff: { Args: { _user_id: string }; Returns: boolean }
      is_my_candidate: { Args: { _cand_id: string }; Returns: boolean }
      is_my_exam: { Args: { _exam_id: string }; Returns: boolean }
      log_permission_denied: {
        Args: { _module?: string; _permission_key: string; _reason?: string }
        Returns: undefined
      }
      recompute_selection_progress: {
        Args: { p_selection_id: string }
        Returns: number
      }
      rollback_import_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: Json
      }
      soft_delete_candidate_cascade: {
        Args: { _candidate_id: string; _reason: string }
        Returns: Json
      }
      update_hari_h_stage: { Args: { p_exam_id: string }; Returns: undefined }
      user_has_section: {
        Args: { _action: string; _section: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "dokter"
        | "registrasi"
        | "kepala_sub_tim"
        | "viewer"
        | "tester"
        | "dokter_spesialis"
        | "dokter_gigi"
        | "radiologi"
        | "lab"
        | "peserta"
        | "casis"
        | "dokter_umum"
        | "pimpinan_viewer"
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
        "super_admin",
        "admin",
        "dokter",
        "registrasi",
        "kepala_sub_tim",
        "viewer",
        "tester",
        "dokter_spesialis",
        "dokter_gigi",
        "radiologi",
        "lab",
        "peserta",
        "casis",
        "dokter_umum",
        "pimpinan_viewer",
      ],
    },
  },
} as const
