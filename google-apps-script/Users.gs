/**
 * Users.gs - إدارة شؤون المستخدمين وصلاحياتهم (للمدير فقط)
 * نظام إدارة مكتبة كنيسة مارجرجس بدسوق
 */

/**
 * جلب قائمة المستخدمين لجدول الإدارة (للمدير فقط)
 */
function listUsers(auth) {
  var currentUser = validateAuth(auth, 'admin');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = getSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  
  // حجب كلمات المرور المشفرة لزيادة الأمان
  return users.map(function(u) {
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      active: u.active
    };
  });
}

/**
 * إضافة مستخدم جديد للنظام (للمدير فقط)
 */
function addUser(auth, newUser) {
  var currentUser = validateAuth(auth, 'admin');
  
  if (!newUser || !newUser.username || !newUser.password || !newUser.name || !newUser.role) {
    throw new Error('الرجاء إدخال كافة البيانات المطلوبة للمستخدم الجديد');
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = getSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  
  var cleanUsername = newUser.username.trim().toLowerCase();
  var exists = users.some(function(u) {
    return (u.username || '').toLowerCase() === cleanUsername;
  });
  
  if (exists) {
    throw new Error('اسم المستخدم هذا مسجل بالفعل لمستخدم آخر');
  }
  
  var sheet = getOrCreateSheet(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  var hashedPassword = hashPassword(newUser.password);
  
  var newId = generateId();
  sheet.appendRow([
    newId,
    newUser.username.trim(),
    hashedPassword,
    newUser.name.trim(),
    newUser.role,
    'true' // تفعيل تلقائي
  ]);
  
  logAction(
    currentUser.username,
    currentUser.name,
    currentUser.role,
    'إضافة مستخدم جديد',
    'المستخدمين',
    'اسم المستخدم: ' + newUser.username + ' | الدور: ' + newUser.role
  );
  
  return { success: true };
}

/**
 * تعديل بيانات مستخدم موجود (للمدير فقط)
 */
function updateUser(auth, updatedUser) {
  var currentUser = validateAuth(auth, 'admin');
  
  if (!updatedUser || !updatedUser.id || !updatedUser.name || !updatedUser.role) {
    throw new Error('الرجاء إرسال كافة البيانات المطلوبة للتعديل');
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = getSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  
  var idx = users.findIndex(function(u) {
    return u.id === updatedUser.id;
  });
  
  if (idx === -1) {
    throw new Error('المستخدم المطلوب تعديله غير موجود في النظام');
  }
  
  var targetUser = users[idx];
  
  // حماية: لا يمكن تعديل حساب المدير الأساسي admin إلى librarian
  if (targetUser.username === 'admin' && updatedUser.role !== 'admin') {
    throw new Error('لا يمكن تغيير رتبة المدير العام الافتراضي');
  }
  
  targetUser.name = updatedUser.name.trim();
  targetUser.role = updatedUser.role;
  
  // إذا تم تغيير كلمة المرور
  if (updatedUser.password && updatedUser.password.trim() !== '') {
    targetUser.password = hashPassword(updatedUser.password);
  }
  
  saveSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active'], users);
  
  logAction(
    currentUser.username,
    currentUser.name,
    currentUser.role,
    'تعديل مستخدم',
    'المستخدمين',
    'الاسم المحدث: ' + updatedUser.name + ' | الدور: ' + updatedUser.role
  );
  
  return { success: true };
}

/**
 * حذف مستخدم نهائياً (للمدير فقط)
 */
function deleteUser(auth, userIdToDelete) {
  var currentUser = validateAuth(auth, 'admin');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = getSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  
  var userToDelete = users.find(function(u) { return u.id === userIdToDelete; });
  if (!userToDelete) {
    throw new Error('المستخدم المطلوب حذفه غير موجود');
  }
  
  // حماية: منع المدير من حذف نفسه أو حساب admin الأساسي
  if (userToDelete.id === currentUser.id) {
    throw new Error('لا يمكن للمدير حذف حسابه الخاص وهو متصل بالنظام');
  }
  if (userToDelete.username === 'admin') {
    throw new Error('لا يمكن حذف حساب المدير العام الافتراضي');
  }
  
  var filteredUsers = users.filter(function(u) {
    return u.id !== userIdToDelete;
  });
  
  saveSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active'], filteredUsers);
  
  logAction(
    currentUser.username,
    currentUser.name,
    currentUser.role,
    'حذف مستخدم',
    'المستخدمين',
    'حذف المستخدم: ' + userToDelete.username
  );
  
  return { success: true };
}

/**
 * تفعيل أو تعطيل حساب مستخدم (للمدير فقط)
 */
function toggleUserStatus(auth, userId, activeStatus) {
  var currentUser = validateAuth(auth, 'admin');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = getSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active']);
  
  var user = users.find(function(u) { return u.id === userId; });
  if (!user) {
    throw new Error('المستخدم غير موجود');
  }
  
  if (user.username === 'admin') {
    throw new Error('لا يمكن تعطيل حساب المدير العام الافتراضي');
  }
  if (user.id === currentUser.id) {
    throw new Error('لا يمكنك تعطيل حسابك الشخصي أثناء الاستخدام');
  }
  
  user.active = activeStatus;
  saveSheetData(ss, 'users', ['id', 'username', 'password', 'name', 'role', 'active'], users);
  
  var statusText = activeStatus ? 'تفعيل' : 'تعطيل';
  logAction(
    currentUser.username,
    currentUser.name,
    currentUser.role,
    statusText + ' حساب مستخدم',
    'المستخدمين',
    'المستخدم: ' + user.username
  );
  
  return { success: true };
}
