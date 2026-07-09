/**
 * Auth.gs - نظام التحقق من الهوية والصلاحيات والتشفير الأمن للعمليات
 * نظام إدارة مكتبة كنيسة مارجرجس بدسوق
 */

/**
 * التحقق من بيانات تسجيل الدخول للواجهة الرسومية
 */
function validateLogin(username, password) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  seedUsersIfEmpty(ss); // التأكد من وجود مدير افتراضي
  
  var users = getSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  var cleanUser = (username || '').trim().toLowerCase();
  
  var user = users.find(function(u) {
    return (u.username || '').toLowerCase() === cleanUser;
  });
  
  if (!user) {
    throw new Error('اسم المستخدم غير مسجل');
  }
  
  if (user.username === 'admin') {
    user.active = true; // ضمان عدم تعطيل حساب المدير العام الافتراضي
  }
  
  if (!user.active) {
    throw new Error('هذا الحساب معطل حالياً، يرجى مراجعة المسؤول');
  }
  
  var inputHash = hashPassword(password);
  if (user.password !== inputHash && user.password !== password) {
    throw new Error('كلمة المرور غير صحيحة');
  }
  
  // تسجيل عملية الدخول
  logAction(user.username, user.name, user.role, 'تسجيل دخول', 'النظام', 'تم تسجيل الدخول بنجاح');
  
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    passwordHash: user.password // إرسال الهاش للواجهة لاستخدامه كـ Token للمطابقة اللاحقة
  };
}

/**
 * التحقق من هوية المستخدم وصلاحياته مع كل طلب API
 * يرجع كائن المستخدم الحالي في حال صحة البيانات
 */
function validateAuth(auth, requiredRole) {
  if (!auth || !auth.username || !auth.passwordHash) {
    throw new Error('Authentication required (يرجى تسجيل الدخول أولاً)');
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = getSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  var cleanUser = auth.username.trim().toLowerCase();
  
  var user = users.find(function(u) {
    return (u.username || '').toLowerCase() === cleanUser && u.password === auth.passwordHash;
  });
  
  if (!user) {
    throw new Error('جلسة العمل غير صالحة أو منتهية، يرجى تسجيل الدخول مجدداً');
  }
  
  if (user.username === 'admin') {
    user.active = true;
  }
  
  if (!user.active) {
    throw new Error('هذا الحساب تم تعطيله، يرجى مراجعة المسؤول');
  }
  
  if (requiredRole && requiredRole === 'admin' && user.role !== 'admin') {
    throw new Error('غير مصرح! هذه العملية مخصصة للمدير فقط');
  }
  
  return user;
}

/**
 * إنشاء مستخدم مدير افتراضي إذا كانت قائمة المستخدمين فارغة
 */
function seedUsersIfEmpty(ss) {
  var sheet = getOrCreateSheet(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    var adminPassHash = hashPassword('admin'); // كلمة مرور افتراضية: admin
    sheet.appendRow([
      'admin-init',
      'admin',
      adminPassHash,
      'المدير العام الافتراضي',
      'admin',
      'true'
    ]);
  }
}
