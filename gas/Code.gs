// GET リクエストのハンドラ: IDでH列を検索し、K列のisGoshuguとO列のお車代フラグを返す
function doGet(e) {
  // スプレッドシートIDとシート名をScript Propertiesから取得
  var scriptProperties = PropertiesService.getScriptProperties();
  var SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');
  var SHEET_NAME = scriptProperties.getProperty('SHEET_NAME') || 'Sheet1';

  // GETパラメーターからIDを取得
  var id = e.parameter.id;

  if (!id) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "ID parameter is required"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  // B列からO列まで取得 (B=2から開始)
  var dataStartCol = 2; // B列
  var dataEndCol = 15; // O列
  var numCols = dataEndCol - dataStartCol + 1; // 14列
  var values = sheet.getRange(2, dataStartCol, sheet.getLastRow() - 1, numCols).getValues();

  var found = false;
  var isGoshugu = false;
  var needsOkurumadai = false;
  var guestName = '';

  for (var i = 0; i < values.length; i++) {
    // H列はB列から数えて7番目（配列では6）
    if (values[i][6] === id) { // H列の値とIDを比較
      guestName = values[i][0]; // B列（配列の0番目）
      isGoshugu = values[i][9] === true; // K列（配列の9番目）の値を確認
      needsOkurumadai = values[i][13] === true; // O列（配列の13番目）の値を確認
      found = true;
      break;
    }
  }

  var result = found
    ? { status: "success", isGoshugu: isGoshugu, needsOkurumadai: needsOkurumadai, guestName: guestName }
    : { status: "not found" };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // スプレッドシートIDとシート名をScript Propertiesから取得
  var scriptProperties = PropertiesService.getScriptProperties();
  var SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');
  var SHEET_NAME = scriptProperties.getProperty('SHEET_NAME') || 'Sheet1';
  var LINE_WEBHOOK_SHEET_NAME = scriptProperties.getProperty('LINE_WEBHOOK_SHEET_NAME') || 'LINE_Messages';

  // リクエストボディをパース
  var data = JSON.parse(e.postData.contents);
  
  // LINE webhookからのリクエストを処理
  if (data.action === 'lineWebhook') {
    return handleLineWebhook(data, SPREADSHEET_ID, LINE_WEBHOOK_SHEET_NAME);
  }
  
  // QRコード取得リクエストの処理
  if (data.action === 'getQRCode') {
    return getQRCodeByLineId(data, SPREADSHEET_ID, SHEET_NAME);
  }
  
  // 既存のkazasu処理
  var id = data.id;
  var receivedGoshugu = data.receivedGoshugu;
  var givenOkurumadai = data.givenOkurumadai;

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var values = sheet.getRange(2, 8, sheet.getLastRow() - 1, 1).getValues(); // 2行目以降のH列

  var found = false;
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === id) {
      // L列（12列目）にtrueを書き込む（出席登録）
      sheet.getRange(i + 2, 12).setValue(true);

      // receivedGoshuguが指定されている場合、K列（11列目）にも値を設定
      if (receivedGoshugu !== undefined) {
        sheet.getRange(i + 2, 11).setValue(receivedGoshugu);
      }

      // givenOkurumadaiが指定されている場合、P列（16列目）にも値を設定
      if (givenOkurumadai !== undefined) {
        sheet.getRange(i + 2, 16).setValue(givenOkurumadai);
      }

      found = true;
      break;
    }
  }

  var result = found ? { status: "success" } : { status: "not found" };
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function handleLineWebhook(data, spreadsheetId, sheetName) {
  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet;
    
    // シートが存在しない場合は作成
    try {
      sheet = spreadsheet.getSheetByName(sheetName);
    } catch (e) {
      sheet = spreadsheet.insertSheet(sheetName);
      // ヘッダーを追加
      sheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'User ID', 'Display Name', 'Message', 'Date']]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    
    // 新しい行にデータを追加
    var timestamp = data.timestamp || new Date().toISOString();
    var date = new Date(timestamp);
    var formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    
    sheet.appendRow([
      formattedDate,
      data.userId || '',
      data.displayName || '',
      data.message || '',
      date
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Data saved to spreadsheet'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// LINE IDで招待者を検索してQRコードURLを返す
function getQRCodeByLineId(data, spreadsheetId, sheetName) {
  try {
    var lineId = data.lineId;
    
    if (!lineId) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'LINE ID is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    
    // ヘッダー行を取得して列のインデックスを特定
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var lineIdColumn = -1;
    var qrCodeColumn = -1;
    var nameColumn = -1;
    
    // B列（2列目）を名前列として固定
    nameColumn = 2;

    // LINE ID列とQRコード列を探す（大文字小文字を無視）
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i].toString().toLowerCase();
      // line_id列を検索
      if (header === 'line_id' || header === 'lineid' || header === 'lineユーザーid' || header === 'lineuserid') {
        lineIdColumn = i + 1;
      }
      // QRコード列を検索（スペースやアンダースコアを無視）
      var normalizedHeader = header.replace(/[\s_-]/g, '');
      if (normalizedHeader === 'qrcode' || normalizedHeader === 'qr' || header.indexOf('qrコード') !== -1) {
        qrCodeColumn = i + 1;
      }
    }
    
    if (lineIdColumn === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'LINE ID column not found in spreadsheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (qrCodeColumn === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'QR Code column not found in spreadsheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // データを検索
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    var values = dataRange.getValues();
    
    for (var i = 0; i < values.length; i++) {
      var rowLineId = values[i][lineIdColumn - 1];
      if (rowLineId && rowLineId.toString() === lineId) {
        var cellValue = values[i][qrCodeColumn - 1];
        var guestName = nameColumn !== -1 ? values[i][nameColumn - 1] : '';
        
        // セル内画像の場合、URLを抽出
        var qrCodeUrl = '';
        if (cellValue) {
          // CellImageの場合、実際の画像URLを取得
          if (cellValue.toString() === 'CellImage' || cellValue instanceof Object) {
            // セル内の画像を処理
            var cell = sheet.getRange(i + 2, qrCodeColumn);
            var formula = cell.getFormula();
            
            // =IMAGE()形式の場合
            if (formula && formula.indexOf('IMAGE') !== -1) {
              // 動的URLの場合（例: =IMAGE("https://quickchart.io/qr?size=150x150&text=" & ENCODEURL(H2))）
              if (formula.indexOf('&') !== -1 || formula.indexOf('ENCODEURL') !== -1) {
                // 数式を評価して実際のURLを取得
                try {
                  // 数式内の参照を解決
                  if (formula.indexOf('ENCODEURL') !== -1) {
                    // ENCODEURLの参照セルを取得
                    var cellRefMatch = formula.match(/ENCODEURL\(([A-Z]+\d+)\)/);
                    if (cellRefMatch && cellRefMatch[1]) {
                      var refCell = cellRefMatch[1];
                      var refCol = refCell.match(/[A-Z]+/)[0];
                      var refRow = parseInt(refCell.match(/\d+/)[0]);
                      
                      // 参照セルの値を取得（現在の行と同じ行の場合が多い）
                      if (refRow === 2) {
                        // 相対参照の場合、現在の行に合わせる
                        refRow = i + 2;
                      }
                      
                      var refColNum = columnLetterToNumber(refCol);
                      var refValue = sheet.getRange(refRow, refColNum).getValue();
                      
                      // URLを構築
                      var baseUrl = formula.match(/"([^"&]+)"/)[1];
                      qrCodeUrl = baseUrl + encodeURIComponent(refValue.toString());
                    }
                  } else {
                    // 静的なIMAGE関数の場合
                    var urlMatch = formula.match(/IMAGE\("([^"]+)"/i);
                    if (urlMatch && urlMatch[1]) {
                      qrCodeUrl = urlMatch[1];
                    }
                  }
                } catch (e) {
                  console.error('Error parsing formula:', e);
                }
              } else {
                // 静的なIMAGE関数の場合
                var urlMatch = formula.match(/IMAGE\("([^"]+)"/i);
                if (urlMatch && urlMatch[1]) {
                  qrCodeUrl = urlMatch[1];
                }
              }
            }
            
            // URLが直接入力されている場合
            if (!qrCodeUrl && cellValue.toString().indexOf('http') === 0) {
              qrCodeUrl = cellValue.toString();
            }
            
            // 画像URLが取得できなかった場合、H列の値から直接QRコードURLを生成
            if (!qrCodeUrl) {
              // H列の値を取得（ID列）
              var idValue = values[i][7]; // H列は8番目（0ベース）
              if (idValue) {
                qrCodeUrl = 'https://quickchart.io/qr?size=150x150&text=' + encodeURIComponent(idValue.toString());
              } else {
                return ContentService.createTextOutput(JSON.stringify({
                  status: 'error',
                  message: 'QR code URL could not be generated.'
                })).setMimeType(ContentService.MimeType.JSON);
              }
            }
          } else if (cellValue.toString().indexOf('http') === 0) {
            // 直接URLが入力されている場合
            qrCodeUrl = cellValue.toString();
          }
        }
        
        if (qrCodeUrl) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            qrCodeUrl: qrCodeUrl,
            guestName: guestName.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        } else {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'QR code URL not found for this LINE ID'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'not_found',
      message: 'No guest found with this LINE ID'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 列文字を列番号に変換するヘルパー関数
function columnLetterToNumber(letter) {
  var column = 0;
  var length = letter.length;
  for (var i = 0; i < length; i++) {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column;
}
