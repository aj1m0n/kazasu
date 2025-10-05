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

async function replyMessage(replyToken: string, messages: any[]) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages,
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

async function replyTextMessage(replyToken: string, text: string) {
  return replyMessage(replyToken, [{ type: 'text', text }]);
}

async function replyImageMessage(replyToken: string, imageUrl: string, previewUrl?: string) {
  return replyMessage(replyToken, [{
    type: 'image',
    originalContentUrl: imageUrl,
    previewImageUrl: previewUrl || imageUrl
  }]);
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

async function getQRCodeFromSpreadsheet(userId: string) {
  if (!GAS_URL) {
    throw new Error('GAS_URL is not configured');
  }

  try {
    const response = await axios.post(
      GAS_URL,
      {
        action: 'getQRCode',
        lineId: userId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to get QR code from spreadsheet:', error);
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

        // 「席次表」の場合は何も処理せずに終了
        if (message.text === '席次表') {
          // 何も返信せずに正常終了
          return res.status(200).json({ message: 'OK' });
        }
        
        // QRコードリクエストの処理
        if (message.text === 'QRコード' || message.text === 'qrcode' || message.text === 'QR') {
          try {
            const qrData = await getQRCodeFromSpreadsheet(userId);
            
            if (qrData.status === 'success') {
              const messages = [];
              
              // ゲスト名がある場合はテキストメッセージを追加
              if (qrData.guestName) {
                messages.push({
                  type: 'text',
                  text: `${qrData.guestName}様の受付QRコードです✨`
                });
              }
              
              // QRコード画像を追加（URLが有効か確認）
              if (qrData.qrCodeUrl && qrData.qrCodeUrl.startsWith('http')) {
                messages.push({
                  type: 'image',
                  originalContentUrl: qrData.qrCodeUrl,
                  previewImageUrl: qrData.qrCodeUrl
                });
              } else {
                messages.push({
                  type: 'text',
                  text: 'QRコード画像のURLが正しく取得できませんでした。\nスプレッドシートのQRコード列に画像URLを直接入力するか、=IMAGE("URL")形式で入力してください。'
                });
              }
              
              await replyMessage(replyToken, messages);
            } else if (qrData.status === 'not_found') {
              // 10/12以降は新しいメッセージを表示
              const now = new Date();
              // 現在時刻をJSTに変換 (UTC+9)
              const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
              const cutoffDate = new Date('2025-10-05T00:00:00');

              if (jstNow >= cutoffDate) {
                await replyTextMessage(replyToken, '申し訳ございません。QRコードが登録されていないので受付にてお名前をお伝えください。');
              } else {
                await replyTextMessage(replyToken, 'QRコードが見つかりませんでした。\nお手数おかけしますが、お名前をご記入ください。\n反映までに2日ほどお時間をいただきます。');
              }
            } else if (qrData.message && qrData.message.includes('embedded in cell')) {
              await replyTextMessage(replyToken, 'QRコード画像がセルに埋め込まれています。\nスプレッドシートのQRコード列に画像URLを直接入力するか、=IMAGE("URL")形式で入力してください。');
            } else {
              await replyTextMessage(replyToken, `QRコードの取得中にエラーが発生しました。\n${qrData.message || ''}`);
            }
          } catch (error) {
            console.error('Failed to get QR code:', error);
            await replyTextMessage(replyToken, 'QRコードの取得中にエラーが発生しました。もう一度お試しください。');
          }
        } else {
          // 通常のメッセージ保存処理（返信なし）
          try {
            await saveToSpreadsheet(userId, displayName, message.text);
            // 保存成功しても返信しない
          } catch (error) {
            console.error('Failed to save message:', error);
            // エラーが発生しても返信しない
          }
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