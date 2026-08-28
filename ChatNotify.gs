/**
 * Google Chat Webhook 通知
 */
var ChatNotify = (function () {
  function getWebhookUrl() {
    return PropertiesService.getScriptProperties().getProperty(Config.CHAT_WEBHOOK_KEY);
  }

  /** Google Chat クリック可能リンク（<URL|表示文言> 形式） */
  function getAdminLinkLine() {
    return '<' + Config.ADMIN_URL + '|管理画面で確認する>';
  }

  function buildMessageWithAdminLink(lines) {
    var messageLines = lines.slice();
    messageLines.push('');
    messageLines.push(getAdminLinkLine());
    return messageLines.join('\n');
  }

  function formatApplicableFacilitiesMessage(applicableFacilities) {
    var names = String(applicableFacilities || '').split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean);
    if (!names.length) {
      return '';
    }
    return names.join('・') + 'から応募可能です。';
  }

  function sendMessage(text) {
    try {
      var url = getWebhookUrl();
      if (!url) {
        Logger.log('CHAT_WEBHOOK_URL が未設定のため通知をスキップしました。');
        return;
      }
      var payload = JSON.stringify({ text: text });
      var response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true
      });
      if (response.getResponseCode() >= 400) {
        Logger.log('Chat通知失敗: ' + response.getContentText());
      }
    } catch (e) {
      Logger.log('Chat通知エラー: ' + e.message);
    }
  }

  function notifyNewSlot(slot) {
    var applicableMessage = formatApplicableFacilitiesMessage(slot.applicableFacilities);
    var lines = [
      '【施設間バイト募集】',
      '',
      '勤務日：' + Utils.formatDate(slot.workDate),
      '勤務先：' + slot.targetFacility,
      '勤務区分：' + Config.getShiftTypeStaffLabel(slot.shiftType),
      '職種条件：' + slot.jobCondition
    ];
    if (applicableMessage) {
      lines.push('');
      lines.push(applicableMessage);
    }
    sendMessage(buildMessageWithAdminLink(lines));
  }

  function notifyNewApplication(app) {
    var preferredCode = Config.getEffectivePreferredShiftCode(app);
    var lines = [
      '【施設間バイト応募】',
      '',
      '勤務日：' + Utils.formatDate(app.workDate),
      '勤務先：' + app.workFacility,
      '募集：' + Config.getShiftTypeStaffLabel(app.shiftType),
      '希望：' + Config.getShiftTypeStaffLabel(preferredCode),
      '所属施設：' + app.homeFacility,
      '氏名：' + app.name,
      '職種：' + Config.getJobTypeLabel(app.jobType)
    ];
    if (app.remarks) {
      lines.push('備考：' + app.remarks);
    }
    lines.push('状態：' + app.status);
    sendMessage(buildMessageWithAdminLink(lines));
  }

  function notifyApproved(app, splitInfo) {
    if (splitInfo && splitInfo.confirmedShiftCode && splitInfo.remainderShiftCode) {
      var splitLines = [
        '【施設間バイト承認】',
        '',
        '勤務日：' + Utils.formatDate(app.workDate),
        '勤務先：' + app.workFacility,
        '氏名：' + app.name,
        '勤務確定：' + Config.getShiftTypeStaffLabel(splitInfo.confirmedShiftCode),
        '',
        '承認しました。',
        '',
        '残り時間：',
        Config.getShiftTypeStaffLabel(splitInfo.remainderShiftCode) + 'の募集枠を自動作成しました。'
      ];
      sendMessage(buildMessageWithAdminLink(splitLines));
      return;
    }

    var text = buildMessageWithAdminLink([
      '【施設間バイト承認】',
      '',
      Utils.formatDate(app.workDate) + ' ' + Config.getShiftTypeLabel(app.shiftType),
      app.homeFacility + ' ' + app.name,
      '→ ' + app.workFacility + '勤務を承認しました。'
    ]);
    sendMessage(text);
  }

  function notifyRejected(app) {
    var text = buildMessageWithAdminLink([
      '【施設間バイト否認】',
      '',
      Utils.formatDate(app.workDate) + ' ' + Config.getShiftTypeLabel(app.shiftType),
      app.homeFacility + ' ' + app.name,
      '→ ' + app.workFacility + '勤務を否認しました。'
    ]);
    sendMessage(text);
  }

  function notifyDeleted(app) {
    var text = buildMessageWithAdminLink([
      '【施設間バイト削除】',
      '',
      Utils.formatDate(app.workDate) + ' ' + Config.getShiftTypeLabel(app.shiftType),
      app.homeFacility + ' ' + app.name,
      '→ ' + app.workFacility + '勤務の応募を削除しました。'
    ]);
    sendMessage(text);
  }

  function notifyCancelled(app, confirmedShiftCode) {
    var lines = [
      '【施設間バイト勤務キャンセル】',
      '',
      '勤務日：' + Utils.formatDate(app.workDate),
      '勤務先：' + app.workFacility,
      '氏名：' + app.name,
      '勤務：' + Config.getShiftTypeStaffLabel(confirmedShiftCode),
      '',
      '承認済み勤務をキャンセルしました。',
      '募集枠を再開しました。'
    ];
    sendMessage(buildMessageWithAdminLink(lines));
  }

  function formatWeeklyUnfilledSlotLine(slot) {
    var workDate = Utils.parseDate(slot.workDate);
    var dateLabel = workDate
      ? Utilities.formatDate(workDate, Session.getScriptTimeZone() || 'Asia/Tokyo', 'M/d')
      : '';
    return dateLabel + '　' +
      slot.targetFacility + '　' +
      Config.getShiftTypeLabel(slot.shiftType) + '　' +
      slot.jobCondition;
  }

  function notifyWeeklyUnfilledSlots(slots) {
    try {
      if (!slots || slots.length === 0) {
        Logger.log('今後1週間の未充足枠はありません。');
        return;
      }

      var lines = [
        '【施設間バイト 未充足枠一覧】',
        '',
        '今後1週間の未充足募集です。',
        ''
      ];
      slots.forEach(function (slot) {
        lines.push(formatWeeklyUnfilledSlotLine(slot));
      });
      sendMessage(buildMessageWithAdminLink(lines));
    } catch (e) {
      Logger.log('未充足枠サマリーChat通知エラー: ' + e.message);
      if (e.stack) {
        Logger.log(e.stack);
      }
    }
  }

  function formatPendingApplicationBlock(app) {
    var workDate = Utils.parseDate(app.workDate);
    var dateLabel = workDate
      ? Utilities.formatDate(workDate, Session.getScriptTimeZone() || 'Asia/Tokyo', 'M/d')
      : '';
    var preferredCode = Config.getEffectivePreferredShiftCode(app);
    return [
      dateLabel + '　' + app.workFacility + '　' + Config.getShiftTypeLabel(app.shiftType),
      '応募者：' + app.name,
      '所属：' + app.homeFacility,
      '職種：' + Config.getJobTypeLabel(app.jobType),
      '希望：' + Config.getShiftTypeLabel(preferredCode)
    ].join('\n');
  }

  function notifyWeeklyPendingApplications(applications) {
    try {
      if (!applications || applications.length === 0) {
        Logger.log('今後1週間の承認待ち応募はありません。');
        return;
      }

      var lines = [
        '【施設間バイト 承認待ち一覧】',
        '',
        '今後1週間で、管理者確認待ちの応募があります。',
        ''
      ];
      applications.forEach(function (app, index) {
        if (index > 0) {
          lines.push('');
        }
        lines.push(formatPendingApplicationBlock(app));
      });
      sendMessage(buildMessageWithAdminLink(lines));
    } catch (e) {
      Logger.log('承認待ち応募サマリーChat通知エラー: ' + e.message);
      if (e.stack) {
        Logger.log(e.stack);
      }
    }
  }

  return {
    notifyNewSlot: notifyNewSlot,
    notifyNewApplication: notifyNewApplication,
    notifyApproved: notifyApproved,
    notifyRejected: notifyRejected,
    notifyDeleted: notifyDeleted,
    notifyCancelled: notifyCancelled,
    notifyWeeklyUnfilledSlots: notifyWeeklyUnfilledSlots,
    notifyWeeklyPendingApplications: notifyWeeklyPendingApplications
  };
})();

/**
 * Google Chat Webhook 疎通確認（Apps Scriptエディタから手動実行）
 */
function testChatNotification() {
  var testMessage = '【テスト通知】施設間バイト募集アプリからのGoogle Chat通知テストです。';
  var url = PropertiesService.getScriptProperties().getProperty(Config.CHAT_WEBHOOK_KEY);

  if (!url) {
    var errorMessage = 'CHAT_WEBHOOK_URL が未設定です。スクリプトプロパティを設定してください。';
    Logger.log('ERROR: ' + errorMessage);
    throw new Error(errorMessage);
  }

  Logger.log('Webhook URL: 設定済み（値はログに出力しません）');

  try {
    var payload = JSON.stringify({ text: testMessage });
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true
    });

    var statusCode = response.getResponseCode();
    var responseBody = response.getContentText();

    Logger.log('HTTPステータスコード: ' + statusCode);
    Logger.log('レスポンス本文: ' + responseBody);

    if (statusCode >= 400) {
      throw new Error('Google Chat通知テスト失敗（HTTP ' + statusCode + '）: ' + responseBody);
    }

    Logger.log('Google Chat通知テスト送信成功');
  } catch (e) {
    Logger.log('例外: ' + e.message);
    if (e.stack) {
      Logger.log('スタック: ' + e.stack);
    }
    throw e;
  }
}
