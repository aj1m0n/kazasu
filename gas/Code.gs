// GET リクエストのハンドラ: IDでH列を検索しK列の値に基づいて isGoshugu を返す
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
  // H列からK列まで取得 (H=8, I=9, J=10, K=11 なので4列)
  var values = sheet.getRange(2, 8, sheet.getLastRow() - 1, 4).getValues(); 
  
  var found = false;
  var isGoshugu = false;
  
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === id) { // H列（配列の0番目）の値とIDを比較
      isGoshugu = values[i][3] === true; // K列（配列の3番目）の値を確認
      found = true;
      break;
    }
  }
  
  var result = found 
    ? { status: "success", isGoshugu: isGoshugu }
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

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var values = sheet.getRange(2, 8, sheet.getLastRow() - 1, 1).getValues(); // 2行目以降のH列

  var found = false;
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === id) {
      // J列（10列目）にtrueを書き込む（出席登録）
      sheet.getRange(i + 2, 10).setValue(true);
      
      // receivedGoshuguが指定されている場合、K列（11列目）にも値を設定
      if (receivedGoshugu !== undefined) {
        sheet.getRange(i + 2, 11).setValue(receivedGoshugu);
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
      if (normalizedHeader === 'name' || header === '名前' || header === '氏名') {
        nameColumn = i + 1;
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
        var qrCodeUrl = values[i][qrCodeColumn - 1];
        var guestName = nameColumn !== -1 ? values[i][nameColumn - 1] : '';
        
        if (qrCodeUrl) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            qrCodeUrl: qrCodeUrl.toString(),
            guestName: guestName.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        } else {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'QR code not found for this LINE ID'
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
