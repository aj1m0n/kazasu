import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const gasUrl = process.env.NEXT_PUBLIC_GAS_URL;
  if (!gasUrl) {
    return res.status(500).json({ error: 'GAS URL not configured' });
  }

  if (req.method === 'GET') {
    try {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID parameter is required and must be a string' });
      }
      const response = await axios.get(`${gasUrl}?id=${encodeURIComponent(id)}`);
      return res.status(200).json(response.data);
    } catch (error: any) {
      console.error('Proxy GET error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  } else if (req.method === 'POST') {
    try {
      const response = await axios.post(gasUrl, req.body, {
        headers: { 'Content-Type': 'application/json' }
      });
      return res.status(200).json(response.data);
    } catch (error: any) {
      console.error('Proxy POST error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
