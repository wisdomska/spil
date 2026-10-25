export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string;
          email: string;
          name: string;
          role: Database["public"]["Enums"]["admin_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          name: string;
          role: Database["public"]["Enums"]["admin_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          name?: string;
          role?: Database["public"]["Enums"]["admin_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      answers: {
        Row: {
          player_id: string;
          question_id: string;
          room_id: string;
          round: number;
          updated_at: string;
          value: Database["public"]["Enums"]["answer_value"];
        };
        Insert: {
          player_id: string;
          question_id: string;
          room_id: string;
          round: number;
          updated_at?: string;
          value: Database["public"]["Enums"]["answer_value"];
        };
        Update: {
          player_id?: string;
          question_id?: string;
          room_id?: string;
          round?: number;
          updated_at?: string;
          value?: Database["public"]["Enums"]["answer_value"];
        };
        Relationships: [
          {
            foreignKeyName: "answers_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          admin_user_id: string | null;
          after: Json | null;
          at: string;
          before: Json | null;
          id: number;
          target: string;
          who: string;
        };
        Insert: {
          action: string;
          admin_user_id?: string | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          id?: never;
          target: string;
          who: string;
        };
        Update: {
          action?: string;
          admin_user_id?: string | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          id?: never;
          target?: string;
          who?: string;
        };
        Relationships: [];
      };
      awards: {
        Row: {
          award: string;
          player_id: string;
          position: number;
          reason: string;
          room_id: string;
          round: number;
        };
        Insert: {
          award: string;
          player_id: string;
          position: number;
          reason: string;
          room_id: string;
          round: number;
        };
        Update: {
          award?: string;
          player_id?: string;
          position?: number;
          reason?: string;
          room_id?: string;
          round?: number;
        };
        Relationships: [
          {
            foreignKeyName: "awards_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "awards_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "awards_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      captcha_events: {
        Row: {
          browser: string;
          created_at: string;
          endpoint: string;
          error_codes: string[];
          hostname: string | null;
          id: string;
        };
        Insert: {
          browser?: string;
          created_at?: string;
          endpoint: string;
          error_codes?: string[];
          hostname?: string | null;
          id?: string;
        };
        Update: {
          browser?: string;
          created_at?: string;
          endpoint?: string;
          error_codes?: string[];
          hostname?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      crew_members: {
        Row: {
          crew_id: string;
          joined_at: string;
          nickname: string;
          user_id: string;
        };
        Insert: {
          crew_id: string;
          joined_at?: string;
          nickname: string;
          user_id: string;
        };
        Update: {
          crew_id?: string;
          joined_at?: string;
          nickname?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey";
            columns: ["crew_id"];
            isOneToOne: false;
            referencedRelation: "crews";
            referencedColumns: ["id"];
          },
        ];
      };
      crew_rounds: {
        Row: {
          crew_id: string;
          id: string;
          mode: string;
          played_at: string;
          room_code: string;
          round: number;
          scores: Json;
        };
        Insert: {
          crew_id: string;
          id?: string;
          mode: string;
          played_at?: string;
          room_code: string;
          round: number;
          scores?: Json;
        };
        Update: {
          crew_id?: string;
          id?: string;
          mode?: string;
          played_at?: string;
          room_code?: string;
          round?: number;
          scores?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "crew_rounds_crew_id_fkey";
            columns: ["crew_id"];
            isOneToOne: false;
            referencedRelation: "crews";
            referencedColumns: ["id"];
          },
        ];
      };
      crews: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          invite_token: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          invite_token: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          invite_token?: string;
          name?: string;
        };
        Relationships: [];
      };
      daily_answers: {
        Row: {
          created_at: string;
          day: string;
          question_id: string;
          user_id: string;
          value: Database["public"]["Enums"]["answer_value"];
        };
        Insert: {
          created_at?: string;
          day: string;
          question_id: string;
          user_id: string;
          value: Database["public"]["Enums"]["answer_value"];
        };
        Update: {
          created_at?: string;
          day?: string;
          question_id?: string;
          user_id?: string;
          value?: Database["public"]["Enums"]["answer_value"];
        };
        Relationships: [
          {
            foreignKeyName: "daily_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          enabled: boolean;
          key: string;
        };
        Insert: {
          enabled?: boolean;
          key: string;
        };
        Update: {
          enabled?: boolean;
          key?: string;
        };
        Relationships: [];
      };
      guesses: {
        Row: {
          closest: boolean;
          guesser_id: string;
          points: number | null;
          room_id: string;
          round: number;
          target_id: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          closest?: boolean;
          guesser_id: string;
          points?: number | null;
          room_id: string;
          round: number;
          target_id: string;
          updated_at?: string;
          value: number;
        };
        Update: {
          closest?: boolean;
          guesser_id?: string;
          points?: number | null;
          room_id?: string;
          round?: number;
          target_id?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "guesses_guesser_id_fkey";
            columns: ["guesser_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guesses_guesser_id_fkey";
            columns: ["guesser_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guesses_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guesses_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guesses_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
        ];
      };
      imposters: {
        Row: {
          created_at: string;
          player_id: string;
          room_id: string;
          round: number;
        };
        Insert: {
          created_at?: string;
          player_id: string;
          room_id: string;
          round: number;
        };
        Update: {
          created_at?: string;
          player_id?: string;
          room_id?: string;
          round?: number;
        };
        Relationships: [
          {
            foreignKeyName: "imposters_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "imposters_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "imposters_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          email: string | null;
          id: string;
          name: string | null;
          status: Database["public"]["Enums"]["message_status"];
        };
        Insert: {
          body: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
        };
        Update: {
          body?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
        };
        Relationships: [];
      };
      mode_inputs: {
        Row: {
          body: string | null;
          closest: boolean;
          hidden: boolean;
          id: string;
          kind: string;
          player_id: string;
          points: number | null;
          question_id: string | null;
          room_id: string;
          round: number;
          target_id: string | null;
          updated_at: string;
          value: number | null;
        };
        Insert: {
          body?: string | null;
          closest?: boolean;
          hidden?: boolean;
          id?: string;
          kind: string;
          player_id: string;
          points?: number | null;
          question_id?: string | null;
          room_id: string;
          round: number;
          target_id?: string | null;
          updated_at?: string;
          value?: number | null;
        };
        Update: {
          body?: string | null;
          closest?: boolean;
          hidden?: boolean;
          id?: string;
          kind?: string;
          player_id?: string;
          points?: number | null;
          question_id?: string | null;
          room_id?: string;
          round?: number;
          target_id?: string | null;
          updated_at?: string;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "mode_inputs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mode_inputs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mode_inputs_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mode_inputs_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mode_inputs_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mode_inputs_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
        ];
      };
      pack_plays: {
        Row: {
          day: string;
          pack_id: string;
          started: number;
        };
        Insert: {
          day: string;
          pack_id: string;
          started?: number;
        };
        Update: {
          day?: string;
          pack_id?: string;
          started?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pack_plays_pack_id_fkey";
            columns: ["pack_id"];
            isOneToOne: false;
            referencedRelation: "packs";
            referencedColumns: ["id"];
          },
        ];
      };
      packs: {
        Row: {
          blurb: string;
          format: string;
          heat: Database["public"]["Enums"]["heat_level"] | null;
          icon: string;
          id: string;
          is_adult: boolean;
          min_age: number;
          name: string;
          premium: boolean;
          region: string | null;
          room_id: string | null;
          section: string;
          sort_order: number;
          spice: number;
          status: Database["public"]["Enums"]["pack_status"];
          tone: Database["public"]["Enums"]["pack_tone"];
          updated_at: string;
        };
        Insert: {
          blurb: string;
          format?: string;
          heat?: Database["public"]["Enums"]["heat_level"] | null;
          icon: string;
          id: string;
          is_adult?: boolean;
          min_age?: number;
          name: string;
          premium?: boolean;
          region?: string | null;
          room_id?: string | null;
          section?: string;
          sort_order?: number;
          spice?: number;
          status?: Database["public"]["Enums"]["pack_status"];
          tone?: Database["public"]["Enums"]["pack_tone"];
          updated_at?: string;
        };
        Update: {
          blurb?: string;
          format?: string;
          heat?: Database["public"]["Enums"]["heat_level"] | null;
          icon?: string;
          id?: string;
          is_adult?: boolean;
          min_age?: number;
          name?: string;
          premium?: boolean;
          region?: string | null;
          room_id?: string | null;
          section?: string;
          sort_order?: number;
          spice?: number;
          status?: Database["public"]["Enums"]["pack_status"];
          tone?: Database["public"]["Enums"]["pack_tone"];
          updated_at?: string;
        };
        Relationships: [];
      };
      player_stats: {
        Row: {
          bullseyes: number;
          frame: string;
          games: number;
          hosted: number;
          look: string;
          modes: string[];
          points: number;
          updated_at: string;
          user_id: string;
          wins: number;
        };
        Insert: {
          bullseyes?: number;
          frame?: string;
          games?: number;
          hosted?: number;
          look?: string;
          modes?: string[];
          points?: number;
          updated_at?: string;
          user_id: string;
          wins?: number;
        };
        Update: {
          bullseyes?: number;
          frame?: string;
          games?: number;
          hosted?: number;
          look?: string;
          modes?: string[];
          points?: number;
          updated_at?: string;
          user_id?: string;
          wins?: number;
        };
        Relationships: [];
      };
      players: {
        Row: {
          age_band: Database["public"]["Enums"]["age_band"];
          age_confirmed: boolean;
          answered_count: number;
          answers_submitted_at: string | null;
          avatar: number;
          guesses_submitted_at: string | null;
          hide_name_on_card: boolean;
          id: string;
          is_bot: boolean;
          joined_at: string;
          last_answer_at: string | null;
          last_seen_at: string;
          nickname: string;
          room_id: string;
          rotation_seed: number;
          spill_mode: boolean;
          status: Database["public"]["Enums"]["player_status"];
          user_id: string;
        };
        Insert: {
          age_band?: Database["public"]["Enums"]["age_band"];
          age_confirmed?: boolean;
          answered_count?: number;
          answers_submitted_at?: string | null;
          avatar: number;
          guesses_submitted_at?: string | null;
          hide_name_on_card?: boolean;
          id?: string;
          is_bot?: boolean;
          joined_at?: string;
          last_answer_at?: string | null;
          last_seen_at?: string;
          nickname: string;
          room_id: string;
          rotation_seed: number;
          spill_mode?: boolean;
          status?: Database["public"]["Enums"]["player_status"];
          user_id: string;
        };
        Update: {
          age_band?: Database["public"]["Enums"]["age_band"];
          age_confirmed?: boolean;
          answered_count?: number;
          answers_submitted_at?: string | null;
          avatar?: number;
          guesses_submitted_at?: string | null;
          hide_name_on_card?: boolean;
          id?: string;
          is_bot?: boolean;
          joined_at?: string;
          last_answer_at?: string | null;
          last_seen_at?: string;
          nickname?: string;
          room_id?: string;
          rotation_seed?: number;
          spill_mode?: boolean;
          status?: Database["public"]["Enums"]["player_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          alt_text: string | null;
          answered_count: number;
          id: string;
          is_sample: boolean;
          pack_id: string;
          report_count: number;
          status: Database["public"]["Enums"]["q_status"];
          text: string;
          updated_at: string;
          yes_count: number;
        };
        Insert: {
          alt_text?: string | null;
          answered_count?: number;
          id?: string;
          is_sample?: boolean;
          pack_id: string;
          report_count?: number;
          status?: Database["public"]["Enums"]["q_status"];
          text: string;
          updated_at?: string;
          yes_count?: number;
        };
        Update: {
          alt_text?: string | null;
          answered_count?: number;
          id?: string;
          is_sample?: boolean;
          pack_id?: string;
          report_count?: number;
          status?: Database["public"]["Enums"]["q_status"];
          text?: string;
          updated_at?: string;
          yes_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "questions_pack_id_fkey";
            columns: ["pack_id"];
            isOneToOne: false;
            referencedRelation: "packs";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          mode_input_id: string | null;
          player_id: string | null;
          question_id: string | null;
          reason: string;
          reporter_user_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          room_id: string | null;
          status: Database["public"]["Enums"]["report_status"];
          type: Database["public"]["Enums"]["report_type"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          mode_input_id?: string | null;
          player_id?: string | null;
          question_id?: string | null;
          reason: string;
          reporter_user_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          room_id?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          type: Database["public"]["Enums"]["report_type"];
        };
        Update: {
          created_at?: string;
          id?: string;
          mode_input_id?: string | null;
          player_id?: string | null;
          question_id?: string | null;
          reason?: string;
          reporter_user_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          room_id?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          type?: Database["public"]["Enums"]["report_type"];
        };
        Relationships: [
          {
            foreignKeyName: "reports_mode_input_id_fkey";
            columns: ["mode_input_id"];
            isOneToOne: false;
            referencedRelation: "mode_inputs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      results: {
        Row: {
          avg_guess_about: number;
          label: string;
          mind_reader: number;
          player_id: string;
          rank: number;
          room_id: string;
          round: number;
          spill_score: number;
        };
        Insert: {
          avg_guess_about: number;
          label: string;
          mind_reader: number;
          player_id: string;
          rank: number;
          room_id: string;
          round: number;
          spill_score: number;
        };
        Update: {
          avg_guess_about?: number;
          label?: string;
          mind_reader?: number;
          player_id?: string;
          rank?: number;
          room_id?: string;
          round?: number;
          spill_score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "results_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "results_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "results_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      room_questions: {
        Row: {
          position: number;
          question_id: string;
          room_id: string;
          round: number;
        };
        Insert: {
          position: number;
          question_id: string;
          room_id: string;
          round: number;
        };
        Update: {
          position?: number;
          question_id?: string;
          room_id?: string;
          round?: number;
        };
        Relationships: [
          {
            foreignKeyName: "room_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_questions_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          crew_id: string | null;
          expires_at: string;
          final_round: number;
          guessing_at: string | null;
          host_player_id: string | null;
          id: string;
          min_age: number;
          mode: string;
          pack_id: string;
          question_count: number | null;
          ready_at: string | null;
          reveal_at: string | null;
          reveal_index: number;
          revealed_at: string | null;
          round: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["room_status"];
          tv_token: string | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by: string;
          crew_id?: string | null;
          expires_at?: string;
          final_round?: number;
          guessing_at?: string | null;
          host_player_id?: string | null;
          id?: string;
          min_age?: number;
          mode?: string;
          pack_id: string;
          question_count?: number | null;
          ready_at?: string | null;
          reveal_at?: string | null;
          reveal_index?: number;
          revealed_at?: string | null;
          round?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["room_status"];
          tv_token?: string | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          crew_id?: string | null;
          expires_at?: string;
          final_round?: number;
          guessing_at?: string | null;
          host_player_id?: string | null;
          id?: string;
          min_age?: number;
          mode?: string;
          pack_id?: string;
          question_count?: number | null;
          ready_at?: string | null;
          reveal_at?: string | null;
          reveal_index?: number;
          revealed_at?: string | null;
          round?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["room_status"];
          tv_token?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_crew_id_fkey";
            columns: ["crew_id"];
            isOneToOne: false;
            referencedRelation: "crews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rooms_host_fk";
            columns: ["host_player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rooms_host_fk";
            columns: ["host_player_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rooms_pack_id_fkey";
            columns: ["pack_id"];
            isOneToOne: false;
            referencedRelation: "packs";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          age_lock_hours: number;
          id: boolean;
          max_players: number;
          min_players: number;
          questions_per_game: number;
          updated_at: string;
        };
        Insert: {
          age_lock_hours?: number;
          id?: boolean;
          max_players?: number;
          min_players?: number;
          questions_per_game?: number;
          updated_at?: string;
        };
        Update: {
          age_lock_hours?: number;
          id?: boolean;
          max_players?: number;
          min_players?: number;
          questions_per_game?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      stats_daily: {
        Row: {
          day: string;
          games_finished: number;
          games_started: number;
          joins: number;
        };
        Insert: {
          day: string;
          games_finished?: number;
          games_started?: number;
          joins?: number;
        };
        Update: {
          day?: string;
          games_finished?: number;
          games_started?: number;
          joins?: number;
        };
        Relationships: [];
      };
      text_guesses: {
        Row: {
          answer_id: string;
          author_id: string;
          player_id: string;
          room_id: string;
          round: number;
          updated_at: string;
        };
        Insert: {
          answer_id: string;
          author_id: string;
          player_id: string;
          room_id: string;
          round: number;
          updated_at?: string;
        };
        Update: {
          answer_id?: string;
          author_id?: string;
          player_id?: string;
          room_id?: string;
          round?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "text_guesses_answer_id_fkey";
            columns: ["answer_id"];
            isOneToOne: false;
            referencedRelation: "mode_inputs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "text_guesses_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "text_guesses_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "text_guesses_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "text_guesses_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "text_guesses_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      players_public: {
        Row: {
          answers_submitted: boolean | null;
          avatar: number | null;
          guesses_submitted: boolean | null;
          id: string | null;
          is_host: boolean | null;
          joined_at: string | null;
          nickname: string | null;
          room_id: string | null;
          rotation_seed: number | null;
          spill_mode: boolean | null;
          status: Database["public"]["Enums"]["player_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      advance_room: {
        Args: {
          p_from: Database["public"]["Enums"]["room_status"];
          p_room: string;
          p_to: Database["public"]["Enums"]["room_status"];
        };
        Returns: {
          code: string;
          created_at: string;
          created_by: string;
          crew_id: string | null;
          expires_at: string;
          final_round: number;
          guessing_at: string | null;
          host_player_id: string | null;
          id: string;
          min_age: number;
          mode: string;
          pack_id: string;
          question_count: number | null;
          ready_at: string | null;
          reveal_at: string | null;
          reveal_index: number;
          revealed_at: string | null;
          round: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["room_status"];
          tv_token: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rooms";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      band_floor: {
        Args: { b: Database["public"]["Enums"]["age_band"] };
        Returns: number;
      };
      can_access_room_topic: { Args: { p_topic: string }; Returns: boolean };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window: string };
        Returns: boolean;
      };
      current_player_ids: { Args: never; Returns: string[] };
      expire_rooms: { Args: never; Returns: Json };
      is_admin: {
        Args: { p_roles?: Database["public"]["Enums"]["admin_role"][] };
        Returns: boolean;
      };
      is_crew_member: { Args: { p_crew: string }; Returns: boolean };
      is_room_member: { Args: { p_room: string }; Returns: boolean };
      is_room_revealed: { Args: { p_room: string }; Returns: boolean };
      notify_room: {
        Args: { p_event: string; p_room: string };
        Returns: undefined;
      };
      nudge: { Args: { p_room: string; p_target: string }; Returns: undefined };
      record_join: { Args: never; Returns: undefined };
      record_round_stats: { Args: { p_rows: Json }; Returns: undefined };
      save_answers: {
        Args: {
          p_answers: Json;
          p_player: string;
          p_room: string;
          p_round: number;
        };
        Returns: number;
      };
      save_mode_inputs: {
        Args: {
          p_inputs: Json;
          p_kind: string;
          p_player: string;
          p_room: string;
          p_round: number;
        };
        Returns: number;
      };
      save_results: {
        Args: {
          p_awards: Json;
          p_results: Json;
          p_room: string;
          p_round: number;
        };
        Returns: undefined;
      };
      send_reaction: {
        Args: { p_emoji: string; p_player: string; p_room: string };
        Returns: undefined;
      };
      start_round: {
        Args: { p_n: number; p_pack: string; p_room: string };
        Returns: undefined;
      };
    };
    Enums: {
      admin_role: "owner" | "content_lead" | "moderator";
      age_band: "13_15" | "16_17" | "18_plus";
      answer_value: "yes" | "no" | "skip";
      heat_level: "spicy" | "explicit" | "intense";
      message_status: "new" | "read" | "archived";
      pack_status: "live" | "draft" | "hidden";
      pack_tone: "accent" | "inverse" | "raised";
      player_status: "active" | "left" | "removed" | "sat_out";
      q_status: "live" | "draft" | "hidden";
      report_status: "open" | "actioned" | "dismissed";
      report_type: "question" | "nickname" | "other" | "answer";
      room_status: "lobby" | "answering" | "guessing" | "ready" | "revealed" | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      admin_role: ["owner", "content_lead", "moderator"],
      age_band: ["13_15", "16_17", "18_plus"],
      answer_value: ["yes", "no", "skip"],
      heat_level: ["spicy", "explicit", "intense"],
      message_status: ["new", "read", "archived"],
      pack_status: ["live", "draft", "hidden"],
      pack_tone: ["accent", "inverse", "raised"],
      player_status: ["active", "left", "removed", "sat_out"],
      q_status: ["live", "draft", "hidden"],
      report_status: ["open", "actioned", "dismissed"],
      report_type: ["question", "nickname", "other", "answer"],
      room_status: ["lobby", "answering", "guessing", "ready", "revealed", "closed"],
    },
  },
} as const;
