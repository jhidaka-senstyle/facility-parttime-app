/**
 * 今後1週間の承認待ち応募サマリー
 */
var PendingApplicationSummaryService = (function () {
  var DAYS_AHEAD = 7;

  function getScriptTimeZone() {
    return Session.getScriptTimeZone() || 'Asia/Tokyo';
  }

  function getTodayDateKey() {
    return Utilities.formatDate(new Date(), getScriptTimeZone(), 'yyyy-MM-dd');
  }

  function getDateKeyPlusDays(days) {
    var tz = getScriptTimeZone();
    var todayKey = getTodayDateKey();
    var parts = todayKey.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() + days);
    return Utilities.formatDate(date, tz, 'yyyy-MM-dd');
  }

  function isWorkDateInRange(workDate) {
    var workKey = Utils.toDateKey(workDate);
    if (!workKey) {
      return false;
    }
    return workKey >= getTodayDateKey() && workKey <= getDateKeyPlusDays(DAYS_AHEAD);
  }

  function isPendingTarget(app) {
    if (app.status !== Config.APP_STATUS.PENDING) {
      return false;
    }
    return isWorkDateInRange(app.workDate);
  }

  function compareApplications(a, b) {
    var dateA = Utils.toDateKey(a.workDate);
    var dateB = Utils.toDateKey(b.workDate);
    if (dateA !== dateB) {
      return dateA < dateB ? -1 : 1;
    }
    var facilityCmp = String(a.workFacility).localeCompare(String(b.workFacility), 'ja');
    if (facilityCmp !== 0) {
      return facilityCmp;
    }
    return String(a.name).localeCompare(String(b.name), 'ja');
  }

  function findPendingApplications() {
    return SheetRepository.getAllApplications()
      .filter(isPendingTarget)
      .sort(compareApplications);
  }

  function formatApplicationLogLine(app) {
    var preferredCode = Config.getEffectivePreferredShiftCode(app);
    return [
      '応募ID=' + app.applicationId,
      '勤務日=' + Utils.formatDate(app.workDate),
      '勤務先=' + app.workFacility,
      '氏名=' + app.name,
      '所属=' + app.homeFacility,
      '職種=' + Config.getJobTypeLabel(app.jobType),
      '募集勤務区分=' + Config.getShiftTypeLabel(app.shiftType),
      '希望勤務区分=' + Config.getShiftTypeLabel(preferredCode)
    ].join(', ');
  }

  function runSummary(dryRun) {
    var applications = findPendingApplications();

    if (dryRun) {
      Logger.log('承認待ち応募サマリー dry-run');
      Logger.log('対象期間: ' + getTodayDateKey() + ' ～ ' + getDateKeyPlusDays(DAYS_AHEAD));
      Logger.log('対象件数: ' + applications.length);
      applications.forEach(function (app) {
        Logger.log(formatApplicationLogLine(app));
      });
      return;
    }

    if (applications.length === 0) {
      Logger.log('今後1週間の承認待ち応募はありません。');
      return;
    }

    ChatNotify.notifyWeeklyPendingApplications(applications);
  }

  return {
    findPendingApplications: findPendingApplications,
    runSummary: runSummary,
    getTodayDateKey: getTodayDateKey,
    getEndDateKey: function () {
      return getDateKeyPlusDays(DAYS_AHEAD);
    }
  };
})();

/**
 * 時間主導トリガーから毎日実行（16時台想定）
 */
function sendWeeklyPendingApplicationSummary() {
  PendingApplicationSummaryService.runSummary(false);
}

/**
 * 承認待ち応募サマリー dry-run（Chat送信なし）
 */
function testWeeklyPendingApplicationSummaryDryRun() {
  PendingApplicationSummaryService.runSummary(true);
}
