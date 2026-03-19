import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server misconfigured: Missing Supabase Service Key' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { userIds } = req.body;
  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: 'userIds must be an array' });
  }

  try {
    const counts: Record<string, number> = {};
    const chunkSize = 20;
    
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (id) => {
          const { count, error } = await supabaseAdmin
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', id);
            
          counts[id] = count || 0;
        })
      );
    }
    
    res.status(200).json(counts);
  } catch (error: any) {
    console.error('Error fetching question counts:', error);
    res.status(500).json({ error: error.message });
  }
}
