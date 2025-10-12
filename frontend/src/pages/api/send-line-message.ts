import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function pushMessage(userId: string, guestName: string, giftUrl?: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  }

  let messageText = `本日はご多用のところご列席いただき、誠にありがとうございます✨

${guestName}様にひとつお願いがございます🙇

受付にてお受け取りいただいたビーズのお花を、結婚証明書へ貼り付けていただけますと幸いです🌷

皆さまのお手を添えていただくことで、私たちの誓いがより一層特別なものとなります。

また、ささやかではございますが、オンライン引き出物をご用意いたしました。`;

  if (giftUrl) {
    messageText += `
下記のURLより、お好みの商品をお選びください。
引き菓子・縁起物を含む三品の代わりに、アップグレードした一品をお選びいただくことも可能でございます。

${giftUrl}`;
  } else {
    messageText += `
後日、こちらのLINEよりURLを共有させていただきます。`;
  }

  messageText += `

どうぞ、美味しいお料理と余興をゆっくりとお楽しみくださいませ🤵👰`;

  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: userId,
        messages: [
          {
            type: 'text',
            text: messageText,
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
    console.error('Failed to send LINE message:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lineUserId, guestName, giftUrl } = req.body;

    if (!lineUserId) {
      return res.status(400).json({ error: 'LINE User ID is required' });
    }

    if (!guestName) {
      return res.status(400).json({ error: 'Guest name is required' });
    }

    await pushMessage(lineUserId, guestName, giftUrl);

    return res.status(200).json({ success: true, message: 'LINE message sent successfully' });
  } catch (error) {
    console.error('Error sending LINE message:', error);
    return res.status(500).json({ error: 'Failed to send LINE message' });
  }
}
