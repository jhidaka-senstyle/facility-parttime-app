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
    DELETED: '削除',
    CANCELLED: 'キャンセル済み'
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

  /** 施設マスタ（固定値） */
  var FACILITY_MASTER = [
    {
      code: 'NAGAMINE',
      name: '長嶺',
      applicableNames: '京町台,花園',
      active: true
    },
    {
      code: 'KYOMACHIDAI',
      name: '京町台',
      applicableNames: '長嶺',
      active: true
    },
    {
      code: 'HANAZONO',
      name: '花園',
      applicableNames: '長嶺',
      active: true
    }
  ];

  /** 職種マスタ（固定値） */
  var JOB_TYPE_MASTER = [
    { code: 'NURSE', label: '看護師', active: true },
    { code: 'CAREGIVER', label: '介護士', active: true },
    { code: 'PT', label: '理学療法士', active: true },
    { code: 'OT', label: '作業療法士', active: true },
    { code: 'ST', label: '言語聴覚士', active: true },
    { code: 'OTHER', label: 'その他', active: true }
  ];

  /** 勤務区分マスタ（固定値） */
  var SHIFT_TYPE_MASTER = [
    {
      code: 'FULLDAY',
      label: '終日勤務',
      start: '8:30',
      end: '17:30',
      order: 1,
      active: true
    },
    {
      code: 'AM',
      label: '午前のみ',
      start: '8:30',
      end: '12:30',
      order: 2,
      active: true
    },
    {
      code: 'PM',
      label: '午後のみ',
      start: '13:30',
      end: '17:30',
      order: 3,
      active: true
    }
  ];

  function cloneFacilityMasterRow(row) {
    return {
      code: row.code,
      name: row.name,
      applicableNames: row.applicableNames,
      active: row.active
    };
  }

  function cloneJobTypeMasterRow(row) {
    return {
      code: row.code,
      label: row.label,
      active: row.active
    };
  }

  function cloneShiftTypeMasterRow(row) {
    return {
      code: row.code,
      label: row.label,
      start: row.start,
      end: row.end,
      order: row.order,
      active: row.active
    };
  }

  /** @returns {Array<{code:string,name:string,applicableNames:string,active:boolean}>} */
  function getFacilityMaster() {
    return FACILITY_MASTER.filter(function (row) {
      return row.active !== false;
    }).map(cloneFacilityMasterRow);
  }

  /** @returns {Array<{code:string,label:string,active:boolean}>} */
  function getJobTypeMaster() {
    return JOB_TYPE_MASTER.filter(function (row) {
      return row.active !== false;
    }).map(cloneJobTypeMasterRow);
  }

  /** @returns {Array<{code:string,label:string,start:string,end:string,order:number,active:boolean}>} */
  function getShiftTypes() {
    return SHIFT_TYPE_MASTER.filter(function (row) {
      return row.active !== false;
    }).map(cloneShiftTypeMasterRow);
  }

  var CHAT_WEBHOOK_KEY = 'CHAT_WEBHOOK_URL';

  /** 管理者画面URL */
  var ADMIN_URL =
    'https://script.google.com/a/macros/senstyle.co.jp/s/AKfycbwmqvv1OdUHeQgfhGissHI94WF27eqa92KgS5yliMyJt5MYLE3440dyZc1nL_j9d-rYEw/exec?page=admin';

  /** 応募可能施設の表示名リストを取得 */
  function getApplicableFacilityNames(recruitingFacilityCode) {
    var master = getFacilityMaster();
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
    var master = getFacilityMaster();
    var row = master.find(function (f) {
      return f.code === code;
    });
    return row ? row.name : code;
  }

  /** 施設名から施設コード */
  function getFacilityCode(name) {
    var master = getFacilityMaster();
    var row = master.find(function (f) {
      return f.name === name;
    });
    return row ? row.code : name;
  }

  /** 職種IDから日本語表示名 */
  function getJobTypeLabel(codeOrLabel) {
    var master = getJobTypeMaster();
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
    return getJobTypeMaster().some(function (j) {
      return j.code === code;
    });
  }

  /** 値（IDまたは表示名）から勤務区分IDを解決 */
  function resolveShiftCode(codeOrLabel) {
    var value = String(codeOrLabel || '').trim();
    if (!value) return '';

    var master = getShiftTypes();
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

    var master = getShiftTypes();
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
    return getShiftTypes().filter(function (s) {
      return ACTIVE_SHIFT_CODES.indexOf(s.code) !== -1;
    });
  }

  /** 新規作成用の勤務区分ラベルか */
  function isActiveShiftLabel(label) {
    return getActiveShiftTypesForCreate().some(function (s) {
      return s.label === label;
    });
  }

  /** 応募の希望勤務区分ID（未設定時は勤務区分から補完） */
  function getEffectivePreferredShiftCode(app) {
    var preferred = String(app.preferredShiftType || '').trim();
    if (preferred) {
      return resolveShiftCode(preferred);
    }
    return resolveShiftCode(app.shiftType);
  }

  /** 終日勤務募集か */
  function isFullDayShift(shiftType) {
    return resolveShiftCode(shiftType) === 'FULLDAY';
  }

  /** スタッフ応募フォーム用の希望勤務区分選択肢 */
  function getPreferredShiftOptionsForStaff() {
    return [
      { code: 'FULLDAY', label: '募集どおり終日勤務（8:30-17:30）' },
      { code: 'AM', label: '午前のみ希望（8:30-12:30）' },
      { code: 'PM', label: '午後のみ希望（13:30-17:30）' }
    ];
  }

  /** 管理者カレンダー用：半日希望の表示 suffix */
  function getPreferredShiftCalendarSuffix(slotShiftType, preferredShiftType) {
    if (resolveShiftCode(slotShiftType) !== 'FULLDAY') {
      return '';
    }
    var preferredCode = resolveShiftCode(preferredShiftType);
    if (preferredCode === 'AM') {
      return '｜午前希望';
    }
    if (preferredCode === 'PM') {
      return '｜午後希望';
    }
    return '';
  }

  /**
   * 事前取得した勤務区分マスタで変換するコンテキスト（1リクエスト内再利用用）
   */
  function createShiftTypeContext(shiftTypesMaster) {
    var master = shiftTypesMaster || [];

    function resolveWithMaster(codeOrLabel) {
      var value = String(codeOrLabel || '').trim();
      if (!value) return '';

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

    function getLabelWithMaster(codeOrLabel) {
      var value = String(codeOrLabel || '').trim();
      if (!value) return '';

      var code = resolveWithMaster(value);
      if (SHIFT_LABEL_BY_CODE[code]) {
        return SHIFT_LABEL_BY_CODE[code];
      }
      if (LEGACY_SHIFT_LABEL_BY_CODE[code]) {
        return LEGACY_SHIFT_LABEL_BY_CODE[code];
      }

      var row = master.find(function (s) {
        return s.code === value || s.label === value;
      });
      return row ? row.label : value;
    }

    function getStaffLabelWithMaster(codeOrLabel) {
      var label = getLabelWithMaster(codeOrLabel);
      var code = resolveWithMaster(codeOrLabel);
      var time = SHIFT_TIME_BY_CODE[code];
      if (time) {
        return label + '（' + time + '）';
      }
      return label;
    }

    return {
      resolveShiftCode: resolveWithMaster,
      getShiftTypeLabel: getLabelWithMaster,
      getShiftTypeStaffLabel: getStaffLabelWithMaster,
      isFullDayShift: function (shiftType) {
        return resolveWithMaster(shiftType) === 'FULLDAY';
      }
    };
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
    resolveShiftCode: resolveShiftCode,
    getActiveShiftTypesForCreate: getActiveShiftTypesForCreate,
    isActiveShiftLabel: isActiveShiftLabel,
    getEffectivePreferredShiftCode: getEffectivePreferredShiftCode,
    isFullDayShift: isFullDayShift,
    getPreferredShiftOptionsForStaff: getPreferredShiftOptionsForStaff,
    getPreferredShiftCalendarSuffix: getPreferredShiftCalendarSuffix,
    createShiftTypeContext: createShiftTypeContext,
    getFacilityMaster: getFacilityMaster,
    getJobTypeMaster: getJobTypeMaster,
    getShiftTypes: getShiftTypes
  };
})();
