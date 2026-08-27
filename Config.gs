/**
 * アプリケーション設定・定数
 */
var Config = (function () {
  var SHEETS = {
    SLOTS: '募集枠',
    APPLICATIONS: '応募',
    FACILITIES: '施設マスタ',
    JOB_TYPES: '職種マスタ',
    SHIFT_TYPES: '勤務区分マスタ',
    SETTINGS: '設定'
  };

  var APP_STATUS = {
    PENDING: '承認待ち',
    APPROVED: '承認済',
    REJECTED: '否認',
    DELETED: '削除'
  };

  var SLOT_STATUS = {
    OPEN: '募集中',
    CLOSED: '締切'
  };

  var JOB_CONDITION = {
    ANY: '職種指定なし',
    NURSE: '看護師'
  };

  var JOB_TYPE_NURSE_ID = 'NURSE';

  /** 新勤務区分ID（新規作成で使用） */
  var ACTIVE_SHIFT_CODES = ['FULLDAY', 'AM', 'PM'];

  /** 勤務区分ID → 日本語表示名 */
  var SHIFT_LABEL_BY_CODE = {
    FULLDAY: '終日勤務',
    AM: '午前のみ',
    PM: '午後のみ'
  };

  /** 勤務区分ID → 勤務時間（固定） */
  var SHIFT_TIME_BY_CODE = {
    FULLDAY: '8:30-17:30',
    AM: '8:30-12:30',
    PM: '13:30-17:30'
  };

  /** 旧勤務区分ID → 日本語表示名（既存データ互換） */
  var LEGACY_SHIFT_LABEL_BY_CODE = {
    EARLY: '早出',
    DAY: '日勤',
    LATE: '遅出'
  };

  /** 旧日本語表示名 → 旧勤務区分ID */
  var LEGACY_LABEL_TO_CODE = {
    '早出': 'EARLY',
    '日勤': 'DAY',
    '遅出': 'LATE'
  };

  var ADMIN_FACILITIES = [
    { code: 'KYOMACHIDAI', name: '京町台' },
    { code: 'NAGAMINE', name: '長嶺' },
    { code: 'HANAZONO', name: '花園' }
  ];

  var DEFAULT_ADMIN_FACILITY = 'KYOMACHIDAI';

  var CHAT_WEBHOOK_KEY = 'CHAT_WEBHOOK_URL';

  /** 管理者画面URL */
  var ADMIN_URL =
    'https://script.google.com/a/macros/senstyle.co.jp/s/AKfycbwmqvv1OdUHeQgfhGissHI94WF27eqa92KgS5yliMyJt5MYLE3440dyZc1nL_j9d-rYEw/exec?page=admin';

  /** 応募可能施設の表示名リストを取得 */
  function getApplicableFacilityNames(recruitingFacilityCode) {
    var master = SheetRepository.getFacilityMaster();
    var row = master.find(function (f) {
      return f.code === recruitingFacilityCode;
    });
    if (!row || !row.applicableNames) {
      return [];
    }
    return row.applicableNames.split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean);
  }

  /** 施設コードから施設名 */
  function getFacilityName(code) {
    var master = SheetRepository.getFacilityMaster();
    var row = master.find(function (f) {
      return f.code === code;
    });
    return row ? row.name : code;
  }

  /** 施設名から施設コード */
  function getFacilityCode(name) {
    var master = SheetRepository.getFacilityMaster();
    var row = master.find(function (f) {
      return f.name === name;
    });
    return row ? row.code : name;
  }

  /** 職種IDから日本語表示名 */
  function getJobTypeLabel(codeOrLabel) {
    var master = SheetRepository.getJobTypeMaster();
    var byCode = master.find(function (j) {
      return j.code === codeOrLabel;
    });
    if (byCode) {
      return byCode.label;
    }
    var byLabel = master.find(function (j) {
      return j.label === codeOrLabel;
    });
    if (byLabel) {
      return byLabel.label;
    }
    return codeOrLabel;
  }

  /** 職種IDがマスタに存在するか */
  function isValidJobTypeCode(code) {
    return SheetRepository.getJobTypeMaster().some(function (j) {
      return j.code === code;
    });
  }

  /** 値（IDまたは表示名）から勤務区分IDを解決 */
  function resolveShiftCode(codeOrLabel) {
    var value = String(codeOrLabel || '').trim();
    if (!value) return '';

    var master = SheetRepository.getShiftTypes();
    var byCode = master.find(function (s) {
      return s.code === value;
    });
    if (byCode) return byCode.code;

    var byLabel = master.find(function (s) {
      return s.label === value;
    });
    if (byLabel) return byLabel.code;

    if (LEGACY_LABEL_TO_CODE[value]) {
      return LEGACY_LABEL_TO_CODE[value];
    }
    if (LEGACY_SHIFT_LABEL_BY_CODE[value]) {
      return value;
    }
    return value;
  }

  /** 勤務区分IDまたは保存値から日本語表示名（時刻なし） */
  function getShiftTypeLabel(codeOrLabel) {
    var value = String(codeOrLabel || '').trim();
    if (!value) return '';

    var code = resolveShiftCode(value);
    if (SHIFT_LABEL_BY_CODE[code]) {
      return SHIFT_LABEL_BY_CODE[code];
    }
    if (LEGACY_SHIFT_LABEL_BY_CODE[code]) {
      return LEGACY_SHIFT_LABEL_BY_CODE[code];
    }

    var master = SheetRepository.getShiftTypes();
    var row = master.find(function (s) {
      return s.code === value || s.label === value;
    });
    return row ? row.label : value;
  }

  /** スタッフ画面用：日本語表示名＋勤務時間 */
  function getShiftTypeStaffLabel(codeOrLabel) {
    var label = getShiftTypeLabel(codeOrLabel);
    var code = resolveShiftCode(codeOrLabel);
    var time = SHIFT_TIME_BY_CODE[code];
    if (time) {
      return label + '（' + time + '）';
    }
    return label;
  }

  /** 新規作成で選択可能な勤務区分（マスタから取得） */
  function getActiveShiftTypesForCreate() {
    return SheetRepository.getShiftTypes().filter(function (s) {
      return ACTIVE_SHIFT_CODES.indexOf(s.code) !== -1;
    });
  }

  /** 新規作成用の勤務区分ラベルか */
  function isActiveShiftLabel(label) {
    return getActiveShiftTypesForCreate().some(function (s) {
      return s.label === label;
    });
  }

  return {
    SHEETS: SHEETS,
    APP_STATUS: APP_STATUS,
    SLOT_STATUS: SLOT_STATUS,
    JOB_CONDITION: JOB_CONDITION,
    JOB_TYPE_NURSE_ID: JOB_TYPE_NURSE_ID,
    ADMIN_FACILITIES: ADMIN_FACILITIES,
    DEFAULT_ADMIN_FACILITY: DEFAULT_ADMIN_FACILITY,
    CHAT_WEBHOOK_KEY: CHAT_WEBHOOK_KEY,
    ADMIN_URL: ADMIN_URL,
    getApplicableFacilityNames: getApplicableFacilityNames,
    getFacilityName: getFacilityName,
    getFacilityCode: getFacilityCode,
    getJobTypeLabel: getJobTypeLabel,
    isValidJobTypeCode: isValidJobTypeCode,
    getShiftTypeLabel: getShiftTypeLabel,
    getShiftTypeStaffLabel: getShiftTypeStaffLabel,
    getActiveShiftTypesForCreate: getActiveShiftTypesForCreate,
    isActiveShiftLabel: isActiveShiftLabel
  };
})();
