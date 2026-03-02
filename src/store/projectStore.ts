import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';

export interface Project {
  id: string;
  created_at: string;
  name: string;
  description: string;
  subject: string;
  class_grade: string;
}

export interface ProjectQuestion {
  id: string;
  project_id: string;
  question_id: string;
  order_index: number;
  questions?: any; // Joined from questions table
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  projectQuestions: ProjectQuestion[];
  loading: boolean;
  
  fetchProjects: (userId: string) => Promise<void>;
  createProject: (userId: string, data: Partial<Project>) => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<void>;
  
  fetchProjectDetails: (projectId: string) => Promise<void>;
  addQuestionsToProject: (projectId: string, questionIds: string[]) => Promise<void>;
  removeQuestionFromProject: (questionId: string) => Promise<void>;
  reorderQuestions: (projectId: string, reorderedQuestions: ProjectQuestion[]) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  projectQuestions: [],
  loading: false,

  fetchProjects: async (userId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      set({ projects: data || [] });
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (userId: string, data: Partial<Project>) => {
    try {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          created_by: userId,
          name: data.name,
          description: data.description,
          subject: data.subject,
          class_grade: data.class_grade
        })
        .select()
        .single();
        
      if (error) throw error;
      
      set(state => ({ projects: [newProject, ...state.projects] }));
      return newProject;
    } catch (error) {
      console.error("Error creating project:", error);
      return null;
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      set(state => ({ projects: state.projects.filter(p => p.id !== projectId) }));
    } catch (error) {
      console.error("Error deleting project:", error);
      throw error;
    }
  },

  fetchProjectDetails: async (projectId: string) => {
    set({ loading: true });
    try {
      const [projectRes, questionsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_questions').select('*, questions(*)').eq('project_id', projectId).order('order_index', { ascending: true })
      ]);

      if (projectRes.error) throw projectRes.error;
      if (questionsRes.error) throw questionsRes.error;

      set({ 
        currentProject: projectRes.data, 
        projectQuestions: questionsRes.data || [] 
      });
    } catch (error) {
      console.error("Error fetching project details:", error);
    } finally {
      set({ loading: false });
    }
  },

  addQuestionsToProject: async (projectId: string, questionIds: string[]) => {
    try {
      // Get current max order_index
      const { data: maxOrderData, error: maxOrderError } = await supabase
        .from('project_questions')
        .select('order_index')
        .eq('project_id', projectId)
        .order('order_index', { ascending: false })
        .limit(1);

      if (maxOrderError) throw maxOrderError;

      const currentMaxOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order_index : -1;

      // Get existing question IDs to prevent duplicates
      const { data: existingData, error: existingError } = await supabase
        .from('project_questions')
        .select('question_id')
        .eq('project_id', projectId)
        .in('question_id', questionIds);

      if (existingError) throw existingError;

      const existingIds = new Set(existingData?.map(d => d.question_id) || []);
      const newQuestionIds = questionIds.filter(id => !existingIds.has(id));

      if (newQuestionIds.length === 0) {
        return; // All questions already exist in the project
      }

      const itemsToInsert = newQuestionIds.map((qId, index) => ({
        project_id: projectId,
        question_id: qId,
        order_index: currentMaxOrder + 1 + index
      }));

      const { data, error } = await supabase
        .from('project_questions')
        .insert(itemsToInsert)
        .select('*, questions(*)');

      if (error) throw error;

      // If we are currently viewing this project, update the state
      if (get().currentProject?.id === projectId) {
        set(state => ({ 
          projectQuestions: [...state.projectQuestions, ...(data || [])] 
        }));
      }
    } catch (error) {
      console.error("Error adding questions to project:", error);
      throw error;
    }
  },

  removeQuestionFromProject: async (questionId: string) => {
    try {
      const { error } = await supabase.from('project_questions').delete().eq('id', questionId);
      if (error) throw error;
      
      set(state => ({ 
        projectQuestions: state.projectQuestions.filter(q => q.id !== questionId) 
      }));
    } catch (error) {
      console.error("Error removing question:", error);
      throw error;
    }
  },

  reorderQuestions: async (projectId: string, reorderedQuestions: ProjectQuestion[]) => {
    // Optimistic update
    set({ projectQuestions: reorderedQuestions });
    
    try {
      // Update order_index in DB one by one
      for (let i = 0; i < reorderedQuestions.length; i++) {
        const pq = reorderedQuestions[i];
        if (pq.order_index !== i) {
          await supabase
            .from('project_questions')
            .update({ order_index: i })
            .eq('id', pq.id);
        }
      }
    } catch (error) {
      console.error("Error reordering questions:", error);
      // Revert on error by refetching
      get().fetchProjectDetails(projectId);
    }
  }
}));
