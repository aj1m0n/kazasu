import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import crypto from 'crypto';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL;

function validateSignature(body: string, signature: string): boolean {
  if (!LINE_CHANNEL_SECRET) return false;
  
  const hash = crypto
    .createHmac('SHA256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

async function replyMessage(replyToken: string, message: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );
  } catch (error) {
    console.error('Failed to send reply:', error);
  }
}

async function saveToSpreadsheet(userId: string, displayName: string, message: string) {
  if (!GAS_URL) {
    throw new Error('GAS_URL is not configured');
  }

  try {
    const response = await axios.post(
      GAS_URL,
      {
        action: 'lineWebhook',
        userId,
        displayName,
        message,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to save to spreadsheet:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-line-signature'] as string;
  if (!signature) {
    return res.status(400).json({ error: 'No signature' });
  }

  const body = JSON.stringify(req.body);
  if (!validateSignature(body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const { events } = req.body;

    if (!events || events.length === 0) {
      return res.status(200).json({ message: 'No events' });
    }

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const { replyToken, source, message } = event;
        const userId = source.userId || 'unknown';
        
        let displayName = 'Unknown User';
        if (LINE_CHANNEL_ACCESS_TOKEN && source.userId) {
          try {
            const profileResponse = await axios.get(
              `https://api.line.me/v2/bot/profile/${source.userId}`,
              {
                headers: {
                  Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
                },
              }
            );
            displayName = profileResponse.data.displayName || displayName;
          } catch (error) {
            console.error('Failed to get user profile:', error);
          }
        }

        try {
          await saveToSpreadsheet(userId, displayName, message.text);
          await replyMessage(replyToken, 'メッセージを記録しました✅');
        } catch (error) {
          console.error('Failed to save message:', error);
          await replyMessage(replyToken, 'エラーが発生しました。もう一度お試しください。');
        }
      }
    }

    return res.status(200).json({ message: 'OK' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};