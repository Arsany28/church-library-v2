/**
 * Code.gs - توجيه الطلبات الرئيسي ودعم التوافقية الرجعية لنظام إدارة المكتبة
 * نظام إدارة مكتبة كنيسة مارجرجس بدسوق
 */

function doGet(e) {
  // للتحقق السريع من عمل الـ Web App من المتصفح مباشرة
  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'success', 
    message: 'Church Library Backend API is running successfully.' 
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    return handleRequest(request);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: 'خطأ في معالجة طلب خادم الـ API: ' + err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * معالج الطلبات الرئيسي (Router) لتوجيه العمليات للملفات المختصة
 */
function handleRequest(request) {
  var action = request.action;
  var auth = request.auth; // يحتوي على { username, passwordHash }
  var result = {};
  
  try {
    // 1. عمليات التحقق من الهوية والدخول
    if (action === 'login') {
      result = {
        status: 'success',
        data: validateLogin(request.username, request.password)
      };
    } 
    
    // 2. عمليات بيانات المكتبة العامة (كتب - مستعيرين - استعارات)
    else if (action === 'getAll') {
      result = {
        status: 'success',
        data: getLibraryData(auth)
      };
    } else if (action === 'saveAll') {
      result = {
        status: 'success',
        data: saveLibraryData(auth, request.data)
      };
    } 
    
    // 3. عمليات إدارة حسابات أمناء المكتبة (للمدير فقط)
    else if (action === 'listUsers') {
      result = {
        status: 'success',
        data: listUsers(auth)
      };
    } else if (action === 'addUser') {
      result = {
        status: 'success',
        data: addUser(auth, request.newUser)
      };
    } else if (action === 'updateUser') {
      result = {
        status: 'success',
        data: updateUser(auth, request.updatedUser)
      };
    } else if (action === 'deleteUser') {
      result = {
        status: 'success',
        data: deleteUser(auth, request.userId)
      };
    } else if (action === 'toggleUserStatus') {
      result = {
        status: 'success',
        data: toggleUserStatus(auth, request.userId, request.activeStatus)
      };
    } 
    
    // 4. جلب سجل النشاط العام للنظام (للمدير فقط)
    else if (action === 'getLogs') {
      result = {
        status: 'success',
        data: getLogsData(auth)
      };
    } 
    
    // 5. عمليات الكتالوج العام وطلبات الاستعارة الذاتية (بدون تسجيل دخول)
    else if (action === 'getPublicCatalog') {
      result = {
        status: 'success',
        data: getPublicCatalogData()
      };
    } else if (action === 'submitGuestRequest') {
      result = {
        status: 'success',
        data: submitGuestRequestData(request.newRequest)
      };
    }
    
    // إجراء غير معرّف
    else {
      result = {
        status: 'error',
        message: 'الإجراء المطلوب غير معرّف في خادم التطبيق: ' + action
      };
    }
    
  } catch (err) {
    // إرجاع رسالة الخطأ بشكل نظيف وبدون بادئة 'Error:'
    result = {
      status: 'error',
      message: err.toString().replace(/^Error:\s*/, '')
    };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
