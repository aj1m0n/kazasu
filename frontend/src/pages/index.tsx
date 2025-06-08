import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';

export default function Home() {
  const [scanResult, setScanResult] = useState('');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error' | 'not-found' | 'processing' | 'confirm-goshugu'>('idle');
  const [message, setMessage] = useState('');
  const [currentId, setCurrentId] = useState('');
  const [isGoshugu, setIsGoshugu] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Move the functions outside useEffect to avoid ES5 strict mode issues
  const onScanSuccess = (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setScanResult(decodedText);
    setStatus('idle');
    processScannedData(decodedText);
  };

  const onScanError = (err: unknown) => {
    console.warn(err);
  };

  useEffect(() => {
    // QRコードスキャナーを初期化するのはクライアントサイドのみ
    if (typeof window !== 'undefined' && status === 'scanning') {
      const scanner = new Html5QrcodeScanner(
        'reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      // Store the scanner reference so we can access it in onScanSuccess
      scannerRef.current = scanner;
      
      scanner.render(onScanSuccess, onScanError);

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      };
    }
  }, [status]);

  const processScannedData = async (id: string, receivedGoshugu?: boolean) => {
    try {
      setStatus('processing');
      setMessage(`処理中: ${id}`);
      
      // まずGETリクエストでisGoshuguを確認
      if (receivedGoshugu === undefined) {
        const checkResponse = await axios.get(`/api/gas-proxy?id=${encodeURIComponent(id)}`);
        
        if (checkResponse.data.status === 'success') {
          const { isGoshugu } = checkResponse.data;
          
          // isGoshuguがtrueの場合は直接出席登録
          if (isGoshugu) {
            return processAttendance(id);
          } else {
            // isGoshuguがfalseの場合は確認UIを表示
            setCurrentId(id);
            setStatus('confirm-goshugu');
            setMessage(`${id}さんはご祝儀未確認です。ご祝儀を受け取りましたか？`);
            return;
          }
        } else if (checkResponse.data.status === 'not found') {
          setStatus('not-found');
          setMessage(`エラー: IDが見つかりませんでした (${id})`);
          return;
        } else {
          throw new Error('予期しないレスポンス');
        }
      } else {
        // receivedGoshuguが指定されている場合は直接出席登録
        return processAttendance(id, receivedGoshugu);
      }
    } catch (error) {
      setStatus('error');
      setMessage(`サーバーエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  const processAttendance = async (id: string, receivedGoshugu?: boolean) => {
    try {
      setStatus('processing');
      setMessage(`出席登録中: ${id}`);
      
      // Next.js API route 経由でGASにリクエスト
      const response = await axios.post('/api/gas-proxy', { 
        id,
        receivedGoshugu // undefinedの場合は送信されない
      });
      
      if (response.data.status === 'success') {
        setStatus('success');
        setMessage(`成功: ${id} の出席が記録されました${receivedGoshugu !== undefined ? 
          (receivedGoshugu ? '（ご祝儀あり）' : '（ご祝儀なし）') : ''}`);
      } else {
        setStatus('not-found');
        setMessage(`エラー: IDが見つかりませんでした (${id})`);
      }
    } catch (error) {
      setStatus('error');
      setMessage(`サーバーエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const startScanning = () => {
    setScanResult('');
    setStatus('scanning');
    setMessage('');
  };

  // 手動入力のための状態管理
  const [manualId, setManualId] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      processScannedData(manualId.trim());
      setManualId('');
    }
  };

  return (
    <>
      <Head>
        <title>Kazasu - QRコード読み取りアプリ</title>
        <meta name="description" content="QRコードを読み取り、スプレッドシートを更新するアプリケーション" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="flex min-h-screen flex-col items-center p-4 sm:p-8">
        <div className="max-w-3xl w-full">
          <h1 className="text-3xl font-bold text-center mb-8">Kazasu</h1>
          
          {status !== 'scanning' && (
            <div className="mb-8">
              <button 
                onClick={startScanning}
                className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all mb-4"
              >
                QRコードをスキャンする
              </button>

              <div className="bg-white rounded-lg p-4 shadow">
                <h2 className="text-xl font-semibold mb-4">手動でIDを入力</h2>
                <form onSubmit={handleManualSubmit} className="flex space-x-2">
                  <input
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="ID-0001"
                    className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    送信
                  </button>
                </form>
              </div>
            </div>
          )}
          
          {status === 'scanning' && (
            <div className="mb-8">
              <div id="reader" className="qr-reader border rounded-lg overflow-hidden"></div>
              <button 
                onClick={() => setStatus('idle')}
                className="mt-4 w-full py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all"
              >
                キャンセル
              </button>
            </div>
          )}
          
          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              status === 'success' ? 'bg-green-100 text-green-800' : 
              status === 'error' ? 'bg-red-100 text-red-800' :
              status === 'not-found' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {status === 'processing' && <span className="spinner"></span>}
              {message}
            </div>
          )}
          
          {/* ご祝儀確認UI */}
          {status === 'confirm-goshugu' && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-center">ご祝儀確認</h2>
              <p className="text-center mb-6">{currentId}さんからご祝儀を受け取りましたか？</p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => processScannedData(currentId, true)}
                  className="flex-1 py-3 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all"
                >
                  はい（ご祝儀あり）
                </button>
                <button
                  onClick={() => processScannedData(currentId, false)}
                  className="flex-1 py-3 px-6 bg-orange-600 text-white font-semibold rounded-lg shadow-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all"
                >
                  いいえ（ご祝儀なし）
                </button>
              </div>
              
              <button
                onClick={() => {
                  setStatus('idle');
                  setCurrentId('');
                  setMessage('');
                }}
                className="w-full mt-4 py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all"
              >
                キャンセル
              </button>
            </div>
          )}
          
          {scanResult && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <h2 className="font-semibold mb-2">最後にスキャンされたQRコード:</h2>
              <p className="font-mono break-all">{scanResult}</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
