/**
 * Data.gs - قراءة وحفظ بيانات المكتبة الرئيسية مع تأمين الحذف
 * نظام إدارة مكتبة كنيسة مارجرجس بدسوق
 */

/**
 * جلب بيانات المكتبة بالكامل بعد التحقق من الهوية
 */
function getLibraryData(auth) {
  // التحقق من أن المستخدم مسجل ونشط
  var user = validateAuth(auth);
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var books = getSheetData(ss, 'books', ['id', 'num', 'title', 'author', 'category', 'letter', 'publisher', 'year', 'copies', 'available', 'condition', 'addedAt']);
  var loans = getSheetData(ss, 'loans', ['id', 'bookId', 'bookTitle', 'bookNum', 'bookCondition', 'borrowerName', 'borrowerPhone', 'borrowerService', 'librarianName', 'loanDate', 'returnDate', 'actualReturnDate', 'notes', 'status', 'createdAt']);
  var borrowers = getSheetData(ss, 'borrowers', ['id', 'name', 'phone', 'service', 'totalLoans', 'lastLoan', 'createdAt']);
  var categories = getSheetData(ss, 'categories', ['name', 'letter']);
  
  // قراءة الإعدادات العامة
  var settings = {};
  var settingsSheet = getOrCreateSheet(ss, 'settings', ['key', 'value']);
  var settingsRows = settingsSheet.getDataRange().getValues();
  for (var i = 1; i < settingsRows.length; i++) {
    var key = settingsRows[i][0];
    var val = settingsRows[i][1];
    if (key) {
      try {
        settings[key] = JSON.parse(val);
      } catch(e) {
        settings[key] = val;
      }
    }
  }
  
  // التصنيفات الافتراضية إذا كانت فارغة
  if (categories.length === 0) {
    categories = [
      { name: 'كتاب مقدس', letter: 'B' },
      { name: 'الآباء والقديسين', letter: 'F' },
      { name: 'لاهوت روحي', letter: 'ST' },
      { name: 'لاهوت عقيدي', letter: 'DT' },
      { name: 'طقوس', letter: 'LT' },
      { name: 'تاريخ كنيسة', letter: 'CH' },
      { name: 'تفاسير', letter: 'CM' },
      { name: 'سير وقديسين', letter: 'SB' },
      { name: 'فلسفة وعلم نفس', letter: 'PP' },
      { name: 'أسرة وطفل', letter: 'FC' },
      { name: 'عام', letter: 'GN' }
    ];
  }
  
  return {
    books: books,
    loans: loans,
    borrowers: borrowers,
    categories: categories,
    settings: settings
  };
}

/**
 * حفظ كافة البيانات وتعديلاتها (مع حماية الحذف لأمين المكتبة)
 */
function saveLibraryData(auth, data) {
  // التحقق من هوية ونشاط المستخدم أولاً
  var user = validateAuth(auth);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // منع التضارب والتداخل بين طلبات الحفظ
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // ─── حماية سحابية: منع أمين المكتبة (Librarian) من الحذف أو تعديل الإعدادات ───
    if (user.role === 'librarian') {
      
      // 1. فحص حذف الكتب
      if (data.books) {
        var currentBooks = getSheetData(ss, 'books', ['id', 'num', 'title', 'author', 'category', 'letter', 'publisher', 'year', 'copies', 'available', 'condition', 'addedAt']);
        var incomingBookIds = data.books.map(function(b) { return (b.id || '').toString(); });
        var deletedBooks = currentBooks.filter(function(b) {
          if (!b.id || (b.id || '').toString().trim() === '') return false; // تجاهل السطور القديمة بدون معرف
          return incomingBookIds.indexOf((b.id || '').toString()) === -1;
        });
        if (deletedBooks.length > 0) {
          throw new Error('غير مصرح! لا يملك أمين المكتبة صلاحية حذف الكتب. يرجى مراجعة المسؤول.');
        }
      }
      
      // 2. فحص حذف المستعيرين
      if (data.borrowers) {
        var currentBorrowers = getSheetData(ss, 'borrowers', ['id', 'name', 'phone', 'service', 'totalLoans', 'lastLoan', 'createdAt']);
        var incomingBorrowerIds = data.borrowers.map(function(br) { return (br.id || '').toString(); });
        var deletedBorrowers = currentBorrowers.filter(function(br) {
          if (!br.id || (br.id || '').toString().trim() === '') return false; // تجاهل السطور القديمة بدون معرف
          return incomingBorrowerIds.indexOf((br.id || '').toString()) === -1;
        });
        if (deletedBorrowers.length > 0) {
          throw new Error('غير مصرح! لا يملك أمين المكتبة صلاحية حذف المستعيرين.');
        }
      }
      
      // 3. فحص تعديل الإعدادات العامة للمكتبة
      if (data.settings) {
        var currentSettingsSheet = getOrCreateSheet(ss, 'settings', ['key', 'value']);
        var currentSettingsRows = currentSettingsSheet.getDataRange().getValues();
        var currentSettings = {};
        for (var i = 1; i < currentSettingsRows.length; i++) {
          var k = currentSettingsRows[i][0];
          var v = currentSettingsRows[i][1];
          if (k) currentSettings[k] = v;
        }
        for (var key in data.settings) {
          if (data.settings.hasOwnProperty(key)) {
            var incomingVal = data.settings[key];
            var currentVal = currentSettings[key];
            
            // محاولة فك ترميز القيمة المخزنة إذا كانت كائن JSON
            try {
              currentVal = JSON.parse(currentVal);
            } catch(e) {}
            
            // مقارنة القيم بعد توحيد الصيغة لتفادي الفروق البسيطة مثل علامات الاقتباس
            if (currentVal !== undefined && currentVal !== "" && JSON.stringify(currentVal) !== JSON.stringify(incomingVal)) {
              throw new Error('غير مصرح! لا يملك أمين المكتبة صلاحية تعديل إعدادات المكتبة العامة.');
            }
          }
        }
      }
    }
    
    // ─── تنفيذ الحفظ في الجداول ───
    var logParts = [];
    
    if (data.books) {
      saveSheetData(ss, 'books', ['id', 'num', 'title', 'author', 'category', 'letter', 'publisher', 'year', 'copies', 'available', 'condition', 'addedAt'], data.books);
      logParts.push('كتب (' + data.books.length + ')');
    }
    if (data.loans) {
      saveSheetData(ss, 'loans', ['id', 'bookId', 'bookTitle', 'bookNum', 'bookCondition', 'borrowerName', 'borrowerPhone', 'borrowerService', 'librarianName', 'loanDate', 'returnDate', 'actualReturnDate', 'notes', 'status', 'createdAt'], data.loans);
      logParts.push('استعارات (' + data.loans.length + ')');
    }
    if (data.borrowers) {
      saveSheetData(ss, 'borrowers', ['id', 'name', 'phone', 'service', 'totalLoans', 'lastLoan', 'createdAt'], data.borrowers);
      logParts.push('مستعيرون (' + data.borrowers.length + ')');
    }
    if (data.categories) {
      saveSheetData(ss, 'categories', ['name', 'letter'], data.categories);
    }
    
    // حفظ الإعدادات للمديرين فقط
    if (data.settings && user.role === 'admin') {
      var settingsSheet = getOrCreateSheet(ss, 'settings', ['key', 'value']);
      settingsSheet.clearContents();
      settingsSheet.appendRow(['key', 'value']);
      for (var k in data.settings) {
        if (data.settings.hasOwnProperty(k)) {
          settingsSheet.appendRow([k, JSON.stringify(data.settings[k])]);
        }
      }
      logParts.push('إعدادات النظام');
    }
    
    // تسجيل العملية في ورقة السجلات
    logAction(
      user.username,
      user.name,
      user.role,
      'مزامنة وحفظ البيانات',
      'المكتبة',
      'مزامنة: ' + logParts.join('، ')
    );
    
    return { success: true };
    
  } finally {
    lock.releaseLock();
  }
}
