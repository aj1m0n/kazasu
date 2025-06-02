// OPTIONS メソッドのリクエストに対応するためのdoOptionsハンドラ
function doOptions(e) {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
  
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}

function doPost(e) {
  // CORSヘッダーを設定
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // スプレッドシートIDとシート名をScript Propertiesから取得
  var scriptProperties = PropertiesService.getScriptProperties();
  var SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');
  var SHEET_NAME = scriptProperties.getProperty('SHEET_NAME') || 'Sheet1';

  // リクエストボディをパース
  var data = JSON.parse(e.postData.contents);
  var id = data.id;

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var values = sheet.getRange(2, 8, sheet.getLastRow() - 1, 1).getValues(); // 2行目以降のH列

  var found = false;
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === id) {
      // J列（10列目）にtrueを書き込む
      sheet.getRange(i + 2, 10).setValue(true);
      found = true;
      break;
    }
  }

  var result = found ? { status: "success" } : { status: "not found" };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
}
