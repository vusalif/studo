// Supabase Configuration
// Replace these values with your actual Supabase project credentials

const SUPABASE_CONFIG = {
    url: 'https://muqzrfdryzcrsjkpinrx.supabase.co', // e.g., 'https://your-project.supabase.co'
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXpyZmRyeXpjcnNqa3BpbnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NDM1MjIsImV4cCI6MjA3MDUxOTUyMn0.w7mEQDH8vHrl_PKwWsdwMl0Aa05fVb8IAjZRB9u0Yq8', // e.g., 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXpyZmRyeXpjcnNqa3BpbnJ4Iiwic0a4IjoxNzU0OTQzNTIyLCJleHAiOjIwNzA1MTk1MjJ9.dNqGbXFHUOsBffCX7Sxh1Pdc3LZiFfqIrljeJuouWvw' // Optional, for admin operations
};

// Initialize Supabase client
let supabaseClient = null;
let isInitializing = false;
let initializationPromise = null;

// Function to initialize Supabase client
async function initializeSupabaseClient() {
    if (isInitializing) {
        return initializationPromise;
    }
    
    if (supabaseClient) {
        return supabaseClient;
    }
    
    isInitializing = true;
    initializationPromise = new Promise(async (resolve) => {
        try {
            // Wait for Supabase library to be available
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds max wait
            
            while (attempts < maxAttempts) {
                if (typeof supabase !== 'undefined') {
                    try {
                        supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
                            auth: {
                                autoRefreshToken: true,
                                persistSession: true,
                                detectSessionInUrl: true
                            },
                            global: {
                                headers: {
                                    'Access-Control-Allow-Origin': '*',
                                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                                }
                            }
                        });
                        window.supabaseClient = supabaseClient; // Update global reference
                        console.log('Supabase client initialized successfully');
                        resolve(supabaseClient);
                        return;
                    } catch (error) {
                        console.error('Failed to create Supabase client:', error);
                        resolve(null);
                        return;
                    }
                }
                
                // Wait 100ms before next attempt
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            console.error('Supabase library not loaded after 10 seconds');
            resolve(null);
        } catch (error) {
            console.error('Failed to initialize Supabase client:', error);
            resolve(null);
        } finally {
            isInitializing = false;
        }
    });
    
    return initializationPromise;
}

// Initialize immediately
initializeSupabaseClient().then(client => {
    if (client) {
        console.log('Supabase client ready for use');
    } else {
        console.error('Failed to initialize Supabase client');
    }
});

// Make supabaseClient available globally
window.supabaseClient = supabaseClient;

// Session management
let currentSession = null;
let currentUser = null;

// Initialize session from storage
async function initializeSession() {
    try {
        if (!supabaseClient) {
            console.log('Supabase client not initialized');
            return false;
        }
        
        // Try to get session from Supabase
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.log('Session initialization error:', error.message);
            return false;
        }
        
        if (session) {
            currentSession = session;
            currentUser = session.user;
            console.log('Session initialized successfully');
            return true;
        } else {
            console.log('No active session found');
            return false;
        }
    } catch (error) {
        console.log('Session initialization failed:', error.message);
        return false;
    }
}

// Refresh session if needed
async function refreshSession() {
    try {
        if (!supabaseClient) {
            console.log('Supabase client not initialized');
            return false;
        }
        
        const { data: { session }, error } = await supabaseClient.auth.refreshSession();
        if (error) {
            console.log('Session refresh error:', error.message);
            return false;
        }
        
        if (session) {
            currentSession = session;
            currentUser = session.user;
            console.log('Session refreshed successfully');
            return true;
        } else {
            console.log('No session after refresh');
            return false;
        }
    } catch (error) {
        console.log('Session refresh failed:', error.message);
        return false;
    }
}

// Recover session from localStorage if Supabase session is expired
function recoverSessionFromStorage() {
    try {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const userEmail = localStorage.getItem('userEmail');
        const userId = localStorage.getItem('userId');
        
        if (isLoggedIn && userEmail && userId) {
            // Create a mock session object for local use
            const mockSession = {
                user: {
                    id: userId,
                    email: userEmail
                },
                access_token: 'local_storage_fallback',
                refresh_token: 'local_storage_fallback'
            };
            
            currentSession = mockSession;
            currentUser = mockSession.user;
            console.log('Session recovered from localStorage');
            return true;
        }
        return false;
    } catch (error) {
        console.log('Session recovery failed:', error.message);
        return false;
    }
}

// Authentication functions
const auth = {
    // Sign up new user
    async signUp(email, password, userData = {}) {
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: userData
                }
            });
            
            if (error) throw error;
            
            // Update local session state
            if (data.session) {
                currentSession = data.session;
                currentUser = data.user;
            }
            
            return { data, error: null };
        } catch (error) {
            console.error('Sign up error:', error);
            return { data: null, error };
        }
    },

    // Sign in existing user
    async signIn(email, password) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Update local session state
            if (data.session) {
                currentSession = data.session;
                currentUser = data.user;
            }
            
            return { data, error: null };
        } catch (error) {
            console.error('Sign in error:', error);
            return { data: null, error };
        }
    },

    // Sign out user
    async signOut() {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            
            // Clear local session state
            currentSession = null;
            currentUser = null;
            
            return { error: null };
        } catch (error) {
            console.error('Sign out error:', error);
            return { error };
        }
    },

    // Get current user
    async getCurrentUser() {
        try {
            // First check if we have a cached user
            if (currentUser) {
                return { user: currentUser, error: null };
            }
            
            // Try to get from Supabase
            const { data: { user }, error } = await supabaseClient.auth.getUser();
            if (error) throw error;
            
            // Update cache
            currentUser = user;
            return { user, error: null };
        } catch (error) {
            console.error('Get user error:', error);
            return { user: null, error };
        }
    },

    // Get current session
    async getCurrentSession() {
        try {
            // First check if we have a cached session
            if (currentSession) {
                return { session: currentSession, error: null };
            }
            
            // Try to get from Supabase
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error) throw error;
            
            // Update cache
            currentSession = session;
            if (session) {
                currentUser = session.user;
            }
            
            return { session, error: null };
        } catch (error) {
            console.error('Get session error:', error);
            return { session: null, error };
        }
    },

    // Listen to auth state changes
    onAuthStateChange(callback) {
        return supabaseClient.auth.onAuthStateChange((event, session) => {
            // Update local cache
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                currentSession = session;
                currentUser = session?.user || null;
            } else if (event === 'SIGNED_OUT') {
                currentSession = null;
                currentUser = null;
            }
            
            callback(event, session);
        });
    },

    // Check if user is authenticated
    isAuthenticated() {
        return currentSession !== null && currentUser !== null;
    },

    // Get cached user (no API call)
    getCachedUser() {
        return currentUser;
    },

    // Get cached session (no API call)
    getCachedSession() {
        return currentSession;
    }
};

// Database functions for study sessions
const studySessions = {
    // Get all sessions for current user
    async getAll() {
        try {
            const { data, error } = await supabaseClient
                .from('study_sessions')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Get sessions error:', error);
            return { data: null, error };
        }
    },

    // Delete all sessions for current user
    async deleteAll() {
        try {
            const { error } = await supabaseClient
                .from('study_sessions')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all but keep at least one row
            
            if (error) throw error;
            return { error: null };
        } catch (error) {
            console.error('Delete all sessions error:', error);
            return { error };
        }
    },

    // Get sessions by date range
    async getByDateRange(startDate, endDate) {
        try {
            const { data, error } = await supabaseClient
                .from('study_sessions')
                .select('*')
                .gte('session_date', startDate)
                .lte('session_date', endDate)
                .order('session_date', { ascending: false });
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Get sessions by date error:', error);
            return { data: null, error };
        }
    },

    // Create new session
    async create(sessionData) {
        try {
            const { data, error } = await supabaseClient
                .from('study_sessions')
                .insert([sessionData])
                .select()
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Create session error:', error);
            return { data: null, error };
        }
    },

    // Update existing session
    async update(id, updates) {
        try {
            const { data, error } = await supabaseClient
                .from('study_sessions')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Update session error:', error);
            return { data: null, error };
        }
    },

    // Delete session
    async delete(id) {
        try {
            const { error } = await supabaseClient
                .from('study_sessions')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return { error: null };
        } catch (error) {
            console.error('Delete session error:', error);
            return { error };
        }
    }
};

// Database functions for timer settings
const timerSettings = {
    // Get current user's timer settings
    async get() {
        try {
            const { data, error } = await supabaseClient
                .from('timer_settings')
                .select('*')
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Get timer settings error:', error);
            return { data: null, error };
        }
    },

    // Delete all timer settings for current user
    async deleteAll() {
        try {
            const { error } = await supabaseClient
                .from('timer_settings')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all but keep at least one row
            
            if (error) throw error;
            return { error: null };
        } catch (error) {
            console.error('Delete all timer settings error:', error);
            return { error };
        }
    },

    // Update timer settings
    async update(updates) {
        try {
            const { data, error } = await supabaseClient
                .from('timer_settings')
                .update(updates)
                .select()
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Update timer settings error:', error);
            return { data: null, error };
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        supabase, 
        auth, 
        studySessions, 
        timerSettings, 
        SUPABASE_CONFIG, 
        initializeSession, 
        refreshSession, 
        recoverSessionFromStorage,
        initializeSupabaseClient,
        isSupabaseReady: () => !!supabaseClient
    };
} else {
    window.SupabaseService = { 
        supabase: supabaseClient, // Direct access to the client
        auth, 
        studySessions, 
        timerSettings, 
        SUPABASE_CONFIG,
        initializeSession, // Add session initialization function
        refreshSession, // Add session refresh function
        recoverSessionFromStorage, // Add session recovery function
        initializeSupabaseClient, // Add initialization function
        isSupabaseReady: () => !!supabaseClient, // Add ready check function
        
        // Add convenience methods that index.html expects
        async getCurrentSession() {
            const result = await auth.getCurrentSession();
            return result.session;
        },
        
        async getCurrentUser() {
            const result = await auth.getCurrentUser();
            return result.user;
        },
        
        async initializeSession() {
            return await initializeSession();
        }
    };
}

// Add a global function to check if Supabase is ready
window.isSupabaseReady = () => !!supabaseClient;
