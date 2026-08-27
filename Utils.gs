/**
 * 共通ユーティリティ
 */
var Utils = (function () {
  function now() {
    return new Date();
  }

  function formatDate(date) {
    if (!date) return '';
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  }

  function formatDateTime(date) {
    if (!date) return '';
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss');
  }

  function parseDate(value) {
    if (value instanceof Date) return value;
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function toDateKey(date) {
    var d = parseDate(date);
    if (!d) return '';
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  function isPastDate(date) {
    var d = parseDate(date);
    if (!d) return true;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return target < today;
  }

  function generateId() {
    return Utilities.getUuid();
  }

  function remainingCount(required, tentative, approved) {
    return Number(required) - Number(tentative) - Number(approved);
  }

  function success(data) {
    return { success: true, data: data || null };
  }

  function failure(message) {
    return { success: false, message: message || 'エラーが発生しました。' };
  }

  return {
    now: now,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    parseDate: parseDate,
    toDateKey: toDateKey,
    isPastDate: isPastDate,
    generateId: generateId,
    remainingCount: remainingCount,
    success: success,
    failure: failure
  };
})();
