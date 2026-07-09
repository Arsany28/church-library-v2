/**
 * Utils.gs - دوال مساعدة لإدارة الجداول، التشفير، وقفل البيانات
 * نظام إدارة مكتبة كنيسة مارجرجس بدسوق
 */

/**
 * جلب أو إنشاء ورقة جديدة مع إضافة العناوين
 */
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

/**
 * قراءة البيانات من جدول معين وتحويلها لمصفوفة كائنات
 */
function getSheetData(ss, name, headers) {
  var sheet = getOrCreateSheet(ss, name, headers);
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  var data = [];
  var fileHeaders = rows[0];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    var hasVal = false;
    for (var j = 0; j < fileHeaders.length; j++) {
      var headerName = fileHeaders[j];
      var cellVal = rows[i][j];
      if (cellVal !== undefined && cellVal !== "") {
        hasVal = true;
      }
      obj[headerName] = cellVal;
    }
    if (hasVal) {
      // تحويل القيم الرقمية للتأكد من سلامة الحسابات
      if (obj.copies !== undefined) obj.copies = Number(obj.copies) || 1;
      if (obj.available !== undefined) obj.available = Number(obj.available) || 0;
      if (obj.totalLoans !== undefined) obj.totalLoans = Number(obj.totalLoans) || 0;
      
      // تحويل القيم المنطقية للمستخدمين
      if (obj.active !== undefined && obj.active !== "") {
        obj.active = (obj.active === true || obj.active === 'true' || obj.active === 1 || obj.active === '1');
      } else {
        obj.active = true; // تفعيل تلقائي للحسابات القديمة متوافق مع الاستيراد
      }
      
      data.push(obj);
    }
  }
  return data;
}

/**
 * حفظ مصفوفة كائنات بالكامل في جدول معين
 */
function saveSheetData(ss, name, headers, dataList) {
  var sheet = getOrCreateSheet(ss, name, headers);
  sheet.clearContents();
  sheet.appendRow(headers);
  if (!dataList || dataList.length === 0) return;
  
  var outputRows = [];
  for (var i = 0; i < dataList.length; i++) {
    var item = dataList[i];
    var row = [];
    for (var j = 0; j < headers.length; j++) {
      var val = item[headers[j]];
      row.push(val !== undefined && val !== null ? val : '');
    }
    outputRows.push(row);
  }
  
  sheet.getRange(2, 1, outputRows.length, headers.length).setValues(outputRows);
}

/**
 * تشفير كلمة المرور باستخدام خوارزمية SHA-256
 */
function hashPassword(password) {
  if (!password) return '';
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  var hexString = '';
  for (var i = 0; i < digest.length; i++) {
    var byteValue = digest[i];
    if (byteValue < 0) byteValue += 256;
    var byteString = byteValue.toString(16);
    if (byteString.length == 1) byteString = '0' + byteString;
    hexString += byteString;
  }
  return hexString;
}

/**
 * جلب التاريخ الحالي بتوقيت مصر كـ String
 */
function getCurrentDateStr() {
  return Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
}

/**
 * جلب الوقت الحالي بتوقيت مصر كـ String
 */
function getCurrentTimeStr() {
  return Utilities.formatDate(new Date(), "GMT+3", "HH:mm:ss");
}

/**
 * توليد معرّف عشوائي فريد
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
