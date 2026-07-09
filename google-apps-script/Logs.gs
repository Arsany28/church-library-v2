/**
 * Logs.gs - نظام تسجيل النشاط والعمليات للمديرين
 * نظام إدارة مكتبة كنيسة مارجرجس بدسوق
 */

/**
 * تسجيل عملية جديدة في جدول الـ Logs
 */
function logAction(username, name, role, action, section, details) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'logs', ['id', 'username', 'name', 'role', 'action', 'section', 'details', 'date', 'time']);
    
    // إدراج السجل الجديد في الصف الثاني مباشرة (تحت الهيدر) ليكون الترتيب الأحدث دائماً في البداية
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, 9).setValues([[
      generateId(),
      username || 'system',
      name || 'النظام',
      role || 'system',
      action || '',
      section || '',
      details || '',
      getCurrentDateStr(),
      getCurrentTimeStr()
    ]]);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

/**
 * جلب سجلات النشاط (للمدير فقط)
 */
function getLogsData(auth) {
  // التحقق من أن الطلب مرسل من مدير ومصرح له
  var currentUser = validateAuth(auth, 'admin');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logs = getSheetData(ss, 'logs', ['id', 'username', 'name', 'role', 'action', 'section', 'details', 'date', 'time']);
  
  // إرجاع السجلات (الجدول تم إدخاله مرتباً تنازلياً بالفعل)
  return logs;
}
