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

  // リクエストボディをパース
  var data = JSON.parse(e.postData.contents);
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
