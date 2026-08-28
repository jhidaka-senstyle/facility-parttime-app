/**
 * 応募者向けメール通知
 */
var MailNotify = (function () {
  var SENDER_EMAIL = 'ys-compl@senstyle.co.jp';
  var SENDER_NAME = 'メディケア癒やしグループ';

  function getMailOptions() {
    return {
      from: SENDER_EMAIL,
      name: SENDER_NAME
    };
  }

  function sendMailSafe(to, subject, body) {
    try {
      var recipient = String(to || '').trim();
      if (!recipient) {
        return;
      }
      GmailApp.sendEmail(recipient, subject, body, getMailOptions());
    } catch (e) {
      Logger.log('メール送信エラー: ' + e.message);
      if (e.stack) {
        Logger.log(e.stack);
      }
    }
  }

  function formatRemarksLine(remarks) {
    var trimmed = String(remarks || '').trim();
    return '備考：' + (trimmed ? trimmed : 'なし');
  }

  function sendApplicationReceived(application) {
    try {
      var preferredCode = Config.getEffectivePreferredShiftCode(application);
      var lines = [
        application.name + ' 様',
        '',
        '施設間バイトへの応募を受け付けました。',
        '',
        '勤務日：' + Utils.formatDate(application.workDate),
        '勤務先：' + application.workFacility,
        '募集勤務：' + Config.getShiftTypeStaffLabel(application.shiftType),
        '希望勤務：' + Config.getShiftTypeStaffLabel(preferredCode),
        '職種：' + Config.getJobTypeLabel(application.jobType),
        formatRemarksLine(application.remarks),
        '状態：' + application.status,
        '',
        '管理者の確認後、承認結果をメールでお知らせします。',
        '',
        '※このメールは自動送信です。',
        '',
        SENDER_NAME
      ];
      sendMailSafe(
        application.email,
        '【メディケア】施設間バイト応募を受け付けました',
        lines.join('\n')
      );
    } catch (e) {
      Logger.log('応募完了メール処理エラー: ' + e.message);
    }
  }

  function sendApplicationApproved(application, confirmedShiftCode) {
    try {
      var lines = [
        application.name + ' 様',
        '',
        '施設間バイト勤務が承認されました。',
        '',
        '勤務日：' + Utils.formatDate(application.workDate),
        '勤務先：' + application.workFacility,
        '確定勤務：' + Config.getShiftTypeStaffLabel(confirmedShiftCode),
        '職種：' + Config.getJobTypeLabel(application.jobType),
        '',
        '勤務内容をご確認ください。',
        '',
        '※このメールは自動送信です。',
        '',
        SENDER_NAME
      ];
      sendMailSafe(
        application.email,
        '【メディケア】施設間バイト勤務が承認されました',
        lines.join('\n')
      );
    } catch (e) {
      Logger.log('承認メール処理エラー: ' + e.message);
    }
  }

  function sendThreeDayReminder(application, confirmedShiftCode) {
    try {
      var recipient = String(application.email || '').trim();
      if (!recipient) {
        return false;
      }
      var lines = [
        application.name + ' 様',
        '',
        '施設間バイト勤務の3日前となりましたのでお知らせします。',
        '',
        '勤務日：' + Utils.formatDate(application.workDate),
        '勤務先：' + application.workFacility,
        '勤務時間：' + Config.getShiftTypeStaffLabel(confirmedShiftCode),
        '職種：' + Config.getJobTypeLabel(application.jobType),
        '',
        '勤務内容をご確認ください。',
        '',
        '※このメールは自動送信です。',
        '',
        SENDER_NAME
      ];
      GmailApp.sendEmail(
        recipient,
        '【メディケア】施設間バイト勤務3日前のお知らせ',
        lines.join('\n'),
        getMailOptions()
      );
      return true;
    } catch (e) {
      Logger.log('3日前リマインドメール送信エラー: ' + e.message);
      if (e.stack) {
        Logger.log(e.stack);
      }
      return false;
    }
  }

  function sendApplicationCancelled(application, confirmedShiftCode) {
    try {
      var recipient = String(application.email || '').trim();
      if (!recipient) {
        return;
      }
      var lines = [
        application.name + ' 様',
        '',
        '承認済みの施設間バイト勤務がキャンセルされました。',
        '',
        '勤務日：' + Utils.formatDate(application.workDate),
        '勤務先：' + application.workFacility,
        '勤務時間：' + Config.getShiftTypeStaffLabel(confirmedShiftCode),
        '職種：' + Config.getJobTypeLabel(application.jobType),
        '',
        'この勤務はキャンセルとなりました。',
        '',
        '※このメールは自動送信です。',
        '',
        SENDER_NAME
      ];
      GmailApp.sendEmail(
        recipient,
        '【メディケア】施設間バイト勤務キャンセルのお知らせ',
        lines.join('\n'),
        getMailOptions()
      );
    } catch (e) {
      Logger.log('キャンセルメール処理エラー: ' + e.message);
      if (e.stack) {
        Logger.log(e.stack);
      }
    }
  }

  return {
    sendApplicationReceived: sendApplicationReceived,
    sendApplicationApproved: sendApplicationApproved,
    sendApplicationCancelled: sendApplicationCancelled,
    sendThreeDayReminder: sendThreeDayReminder,
    getMailOptions: getMailOptions,
    SENDER_EMAIL: SENDER_EMAIL,
    SENDER_NAME: SENDER_NAME
  };
})();

/**
 * メール送信疎通確認（Apps Scriptエディタから手動実行）
 */
function testMailNotification() {
  var testMessage = [
    'これは施設間バイト募集アプリのメール送信テストです。',
    '',
    '送信元：' + MailNotify.SENDER_EMAIL,
    '表示名：' + MailNotify.SENDER_NAME,
    '',
    '※このメールは自動送信です。',
    '',
    MailNotify.SENDER_NAME
  ].join('\n');

  try {
    GmailApp.sendEmail(
      'j.hidaka@senstyle.co.jp',
      '【メディケア】施設間バイト通知テスト',
      testMessage,
      MailNotify.getMailOptions()
    );
    Logger.log('メール通知テスト送信成功');
  } catch (e) {
    Logger.log('メール通知テスト失敗: ' + e.message);
    if (e.stack) {
      Logger.log(e.stack);
    }
    throw e;
  }
}
