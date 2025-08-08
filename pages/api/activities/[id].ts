
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    
    // Get user from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (req.method === 'PUT') {
      // Update activity
      const { data, error } = await supabase
        .from('activities')
        .update(req.body)
        .eq('id', id)
        .eq('user_id', user.id) // Ensure user owns the activity
        .select();

      if (error) {
        console.error('Database error:', error);
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json({ success: true, data });
      
    } else if (req.method === 'DELETE') {
      // Delete activity
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Ensure user owns the activity

      if (error) {
        console.error('Database error:', error);
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json({ success: true });
      
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
