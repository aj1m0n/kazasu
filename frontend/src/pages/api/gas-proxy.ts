import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const gasUrl = process.env.NEXT_PUBLIC_GAS_URL;
    if (!gasUrl) {
      return res.status(500).json({ error: 'GAS URL not configured' });
    }
    const response = await axios.post(gasUrl, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
