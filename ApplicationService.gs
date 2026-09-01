/**
 * 応募サービス
 */
var ApplicationService = (function () {
  function hasActiveApplication(slotId, applicationsBySlot) {
    var apps = applicationsBySlot && applicationsBySlot[slotId]
      ? applicationsBySlot[slotId]
      : [];
    return apps.some(function (app) {
      return app.status === Config.APP_STATUS.PENDING ||
        app.status === Config.APP_STATUS.APPROVED;
    });
  }

  function canStaffSeeSlot(slot, staffFacilityName, applicationsBySlot) {
    if (Utils.isPastDate(slot.workDate)) return false;

    var applicable = slot.applicableFacilities.split(',').map(function (s) {
      return s.trim();
    });
    if (applicable.indexOf(staffFacilityName) === -1) return false;

    if (slot.slotStatus === Config.SLOT_STATUS.CLOSED) return false;

    if (hasActiveApplication(slot.slotId, applicationsBySlot)) return false;

    var remaining = Utils.remainingCount(
      slot.requiredCount,
      slot.tentativeCount,
      slot.approvedCount
    );
    return remaining > 0;
  }

  function slotToStaffCard(slot, shiftTypeContext) {
    var shift = shiftTypeContext || Config;
    return {
      slotId: slot.slotId,
      workDate: Utils.formatDate(slot.workDate),
      workDateKey: Utils.toDateKey(slot.workDate),
      workFacility: slot.targetFacility,
      shiftType: shift.getShiftTypeLabel(slot.shiftType),
      shiftDisplay: shift.getShiftTypeStaffLabel(slot.shiftType),
      shiftCode: shift.resolveShiftCode(slot.shiftType),
      allowsPreferredShift: shift.isFullDayShift(slot.shiftType),
      jobCondition: slot.jobCondition
    };
  }

  function sortStaffSlots(a, b, shiftTypeContext) {
    var shift = shiftTypeContext || Config;
    var da = Utils.parseDate(a.workDate);
    var db = Utils.parseDate(b.workDate);
    if (da.getTime() !== db.getTime()) {
      return da.getTime() - db.getTime();
    }
    return shift.getShiftTypeLabel(a.shiftType).localeCompare(
      shift.getShiftTypeLabel(b.shiftType), 'ja');
  }

  function buildAvailableStaffSlots(facilityName, allSlots, applicationsBySlot, shiftTypeContext, perfDetail) {
    var filterStartedAt = Date.now();
    var filtered = allSlots.filter(function (slot) {
      return canStaffSeeSlot(slot, facilityName, applicationsBySlot);
    });
    if (perfDetail) {
      perfDetail.filterMs = Date.now() - filterStartedAt;
    }

    var convertStartedAt = Date.now();
    var slots = filtered
      .sort(function (a, b) {
        return sortStaffSlots(a, b, shiftTypeContext);
      })
      .map(function (slot) {
        return slotToStaffCard(slot, shiftTypeContext);
      });
    if (perfDetail) {
      perfDetail.cardConvertMs = Date.now() - convertStartedAt;
    }
    return slots;
  }

  function createStaffPagePerfDetail() {
    return {
      facilityMasterMs: 0,
      jobMasterMs: 0,
      shiftMasterMs: 0,
      slotsReadMs: 0,
      applicationsReadMs: 0,
      mapBuildMs: 0,
      filterMs: 0,
      cardConvertMs: 0,
      otherMs: 0,
      totalMs: 0
    };
  }

  function logStaffPagePerfDetail(perfDetail, label) {
    Logger.log('[StaffPagePerfDetail] label=' + label);
    Logger.log('[StaffPagePerfDetail] facilityMasterMs=' + perfDetail.facilityMasterMs);
    Logger.log('[StaffPagePerfDetail] jobMasterMs=' + perfDetail.jobMasterMs);
    Logger.log('[StaffPagePerfDetail] shiftMasterMs=' + perfDetail.shiftMasterMs);
    Logger.log('[StaffPagePerfDetail] slotsReadMs=' + perfDetail.slotsReadMs);
    Logger.log('[StaffPagePerfDetail] applicationsReadMs=' + perfDetail.applicationsReadMs);
    Logger.log('[StaffPagePerfDetail] mapBuildMs=' + perfDetail.mapBuildMs);
    Logger.log('[StaffPagePerfDetail] filterMs=' + perfDetail.filterMs);
    Logger.log('[StaffPagePerfDetail] cardConvertMs=' + perfDetail.cardConvertMs);
    Logger.log('[StaffPagePerfDetail] otherMs=' + perfDetail.otherMs);
    Logger.log('[StaffPagePerfDetail] totalMs=' + perfDetail.totalMs);
  }

  function logStaffPagePerformance(startedAt, slotCount, applicationCount, availableSlotCount, label) {
    var endedAt = Date.now();
    Logger.log('[StaffPagePerf] ' + label);
    Logger.log('[StaffPagePerf] startedAt=' + Utilities.formatDate(
      new Date(startedAt), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'));
    Logger.log('[StaffPagePerf] endedAt=' + Utilities.formatDate(
      new Date(endedAt), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'));
    Logger.log('[StaffPagePerf] elapsedMs=' + (endedAt - startedAt));
    Logger.log('[StaffPagePerf] slotCount=' + slotCount);
    Logger.log('[StaffPagePerf] applicationCount=' + applicationCount);
    Logger.log('[StaffPagePerf] availableSlotCount=' + availableSlotCount);
  }

  function resolveStaffFacility(facilityCode, facilityMaster) {
    var row = facilityMaster.find(function (f) {
      return f.code === facilityCode;
    });
    if (!row) {
      return null;
    }
    return row.name;
  }

  function loadStaffSlotData(facilityCode, preloaded) {
    preloaded = preloaded || {};
    var perfDetail = preloaded.perfDetail || createStaffPagePerfDetail();
    var loadStartedAt = Date.now();
    var stepStartedAt;

    stepStartedAt = Date.now();
    var facilityMaster = preloaded.facilityMaster;
    if (!facilityMaster) {
      facilityMaster = SheetRepository.getFacilityMaster();
      perfDetail.facilityMasterMs += Date.now() - stepStartedAt;
    }

    stepStartedAt = Date.now();
    var facilityName = resolveStaffFacility(facilityCode, facilityMaster);
    if (!facilityName) {
      perfDetail.totalMs = Date.now() - loadStartedAt;
      return {
        error: '指定された所属施設が見つかりません。',
        perfDetail: perfDetail
      };
    }
    perfDetail.otherMs += Date.now() - stepStartedAt;

    stepStartedAt = Date.now();
    var shiftTypes = preloaded.shiftTypes;
    if (!shiftTypes) {
      shiftTypes = SheetRepository.getShiftTypes();
      perfDetail.shiftMasterMs += Date.now() - stepStartedAt;
    }

    stepStartedAt = Date.now();
    var shiftTypeContext = Config.createShiftTypeContext(shiftTypes);
    perfDetail.otherMs += Date.now() - stepStartedAt;

    stepStartedAt = Date.now();
    var applications = SheetRepository.getAllApplications();
    perfDetail.applicationsReadMs += Date.now() - stepStartedAt;

    stepStartedAt = Date.now();
    var applicationsBySlot = SlotService.buildApplicationsBySlotMap(applications);
    perfDetail.mapBuildMs += Date.now() - stepStartedAt;

    stepStartedAt = Date.now();
    var allSlots = SheetRepository.getAllSlots();
    perfDetail.slotsReadMs += Date.now() - stepStartedAt;

    var slots = buildAvailableStaffSlots(
      facilityName, allSlots, applicationsBySlot, shiftTypeContext, perfDetail);

    perfDetail.totalMs = Date.now() - loadStartedAt;

    return {
      facilityCode: facilityCode,
      facilityName: facilityName,
      applications: applications,
      allSlots: allSlots,
      slots: slots,
      perfDetail: perfDetail
    };
  }

  function validateAndResolvePreferredShift(slot, preferredShiftInput) {
    var slotCode = Config.resolveShiftCode(slot.shiftType);
    var allowedCodes = [];
    var defaultCode = '';

    if (slotCode === 'FULLDAY') {
      allowedCodes = ['FULLDAY', 'AM', 'PM'];
      defaultCode = 'FULLDAY';
    } else if (slotCode === 'AM') {
      allowedCodes = ['AM'];
      defaultCode = 'AM';
    } else if (slotCode === 'PM') {
      allowedCodes = ['PM'];
      defaultCode = 'PM';
    } else {
      defaultCode = slotCode || Config.resolveShiftCode(slot.shiftType);
      allowedCodes = defaultCode ? [defaultCode] : [];
    }

    var preferredCode = String(preferredShiftInput || '').trim();
    if (!preferredCode) {
      preferredCode = defaultCode;
    }

    if (!preferredCode || allowedCodes.indexOf(preferredCode) === -1) {
      return {
        error: '希望勤務区分が正しくありません。'
      };
    }

    return { code: preferredCode };
  }

  function normalizeRemarks(remarks) {
    var trimmed = String(remarks || '').trim();
    if (trimmed.length > 200) {
      return trimmed.substring(0, 200);
    }
    return trimmed;
  }

  function normalizeEmail(email) {
    return String(email || '').trim();
  }

  function isValidEmail(email) {
    var trimmed = normalizeEmail(email);
    if (!trimmed) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  function getConfirmedShiftCodeForApproval(app, slot, shouldSplit) {
    var preferredCode = Config.getEffectivePreferredShiftCode(app);
    if (shouldSplit) {
      return preferredCode;
    }
    var slotCode = Config.resolveShiftCode(slot.shiftType);
    if (slotCode === 'FULLDAY') {
      return preferredCode;
    }
    return slotCode;
  }

  function formatRemarksDisplay(remarks) {
    return remarks ? remarks : 'なし';
  }

  function mapApplicationForAdmin(app) {
    var preferredCode = Config.getEffectivePreferredShiftCode(app);
    return {
      applicationId: app.applicationId,
      slotId: app.slotId,
      name: app.name,
      homeFacility: app.homeFacility,
      jobType: Config.getJobTypeLabel(app.jobType),
      workDate: Utils.formatDate(app.workDate),
      shiftType: Config.getShiftTypeLabel(app.shiftType),
      shiftTypeStaffLabel: Config.getShiftTypeStaffLabel(app.shiftType),
      preferredShiftType: preferredCode,
      preferredShiftDisplay: Config.getShiftTypeStaffLabel(preferredCode),
      remarks: app.remarks || '',
      remarksDisplay: formatRemarksDisplay(app.remarks),
      workFacility: app.workFacility,
      status: app.status,
      appliedAt: Utils.formatDateTime(app.appliedAt)
    };
  }

  function getStaffPageData(facilityCode) {
    var startedAt = Date.now();
    var perfDetail = createStaffPagePerfDetail();
    try {
      var stepStartedAt = Date.now();
      var facilityMaster = SheetRepository.getFacilityMaster();
      perfDetail.facilityMasterMs += Date.now() - stepStartedAt;

      stepStartedAt = Date.now();
      var jobTypes = SheetRepository.getJobTypeMaster();
      perfDetail.jobMasterMs += Date.now() - stepStartedAt;

      var loaded = loadStaffSlotData(facilityCode, {
        facilityMaster: facilityMaster,
        perfDetail: perfDetail
      });
      if (loaded.error) {
        perfDetail.totalMs = Date.now() - startedAt;
        logStaffPagePerfDetail(perfDetail, 'getStaffPageData');
        return Utils.failure(loaded.error);
      }

      stepStartedAt = Date.now();
      var response = Utils.success({
        facilityCode: loaded.facilityCode,
        facilityName: loaded.facilityName,
        jobTypes: jobTypes,
        preferredShiftOptions: Config.getPreferredShiftOptionsForStaff(),
        slots: loaded.slots
      });
      perfDetail.otherMs += Date.now() - stepStartedAt;
      perfDetail.totalMs = Date.now() - startedAt;

      logStaffPagePerformance(
        startedAt,
        loaded.allSlots.length,
        loaded.applications.length,
        loaded.slots.length,
        'getStaffPageData'
      );
      logStaffPagePerfDetail(perfDetail, 'getStaffPageData');

      return response;
    } catch (e) {
      perfDetail.totalMs = Date.now() - startedAt;
      logStaffPagePerfDetail(perfDetail, 'getStaffPageData');
      return Utils.failure('スタッフページデータの取得中にエラーが発生しました: ' + e.message);
    }
  }

  function getAvailableSlotsForStaff(facilityCode) {
    var startedAt = Date.now();
    var perfDetail = createStaffPagePerfDetail();
    try {
      var loaded = loadStaffSlotData(facilityCode, { perfDetail: perfDetail });
      if (loaded.error) {
        perfDetail.totalMs = Date.now() - startedAt;
        logStaffPagePerfDetail(perfDetail, 'getAvailableSlotsForStaff');
        if (loaded.error === '指定された所属施設が見つかりません。') {
          return Utils.failure('所属施設が正しく指定されていません。');
        }
        return Utils.failure(loaded.error);
      }

      perfDetail.totalMs = Date.now() - startedAt;

      logStaffPagePerformance(
        startedAt,
        loaded.allSlots.length,
        loaded.applications.length,
        loaded.slots.length,
        'getAvailableSlotsForStaff'
      );
      logStaffPagePerfDetail(perfDetail, 'getAvailableSlotsForStaff');

      return Utils.success({
        facilityCode: loaded.facilityCode,
        facilityName: loaded.facilityName,
        slots: loaded.slots
      });
    } catch (e) {
      perfDetail.totalMs = Date.now() - startedAt;
      logStaffPagePerfDetail(perfDetail, 'getAvailableSlotsForStaff');
      return Utils.failure('募集の取得中にエラーが発生しました: ' + e.message);
    }
  }

  function hasDuplicateApplication(homeFacility, name, workDate) {
    var dateKey = Utils.toDateKey(workDate);
    var blockingStatuses = [Config.APP_STATUS.PENDING, Config.APP_STATUS.APPROVED];

    return SheetRepository.getAllApplications().some(function (app) {
      if (blockingStatuses.indexOf(app.status) === -1) return false;
      if (app.homeFacility !== homeFacility) return false;
      if (app.name !== name) return false;
      return Utils.toDateKey(app.workDate) === dateKey;
    });
  }

  function validateJobCondition(slot, jobTypeId) {
    if (slot.jobCondition === Config.JOB_CONDITION.ANY) return null;
    if (slot.jobCondition === Config.JOB_CONDITION.NURSE &&
        jobTypeId !== Config.JOB_TYPE_NURSE_ID) {
      return 'この募集は看護師限定です。職種が条件を満たしていません。';
    }
    return null;
  }

  function submitApplication(facilityCode, slotId, name, jobType, preferredShiftType, remarks, email) {
    var lock = LockService.getScriptLock();
    var hasLock = false;
    try {
      lock.waitLock(30000);
      hasLock = true;

      var homeFacilityName = Config.getFacilityName(facilityCode);
      if (!homeFacilityName || homeFacilityName === facilityCode) {
        return Utils.failure('所属施設が正しく指定されていません。');
      }

      var trimmedName = String(name || '').trim();
      if (!trimmedName) {
        return Utils.failure('氏名を入力してください。');
      }

      var trimmedJobTypeId = String(jobType || '').trim();
      if (!trimmedJobTypeId) {
        return Utils.failure('職種を選択してください。');
      }

      if (!Config.isValidJobTypeCode(trimmedJobTypeId)) {
        return Utils.failure('職種が正しくありません。');
      }

      var trimmedEmail = normalizeEmail(email);
      if (!trimmedEmail) {
        return Utils.failure('メールアドレスを入力してください。');
      }
      if (!isValidEmail(trimmedEmail)) {
        return Utils.failure('メールアドレスの形式が正しくありません。');
      }

      var found = SheetRepository.findSlotById(slotId);
      if (!found) {
        return Utils.failure('募集枠が見つかりません。');
      }
      var slot = found.slot;

      if (!canStaffSeeSlot(slot, homeFacilityName)) {
        return Utils.failure('この募集枠には応募できません。定員に達しているか、応募条件を満たしていません。');
      }

      var jobError = validateJobCondition(slot, trimmedJobTypeId);
      if (jobError) {
        return Utils.failure(jobError);
      }

      if (hasDuplicateApplication(homeFacilityName, trimmedName, slot.workDate)) {
        return Utils.failure('同じ日に既に応募済みです。同一日に複数の勤務へは応募できません。');
      }

      var remaining = Utils.remainingCount(
        slot.requiredCount,
        slot.tentativeCount,
        slot.approvedCount
      );
      if (remaining <= 0) {
        return Utils.failure('定員に達しているため応募できません。');
      }

      var preferredResult = validateAndResolvePreferredShift(slot, preferredShiftType);
      if (preferredResult.error) {
        return Utils.failure(preferredResult.error);
      }

      var now = Utils.now();
      var application = {
        applicationId: Utils.generateId(),
        slotId: slot.slotId,
        workDate: slot.workDate,
        workFacility: slot.targetFacility,
        homeFacility: homeFacilityName,
        name: trimmedName,
        jobType: trimmedJobTypeId,
        shiftType: slot.shiftType,
        status: Config.APP_STATUS.PENDING,
        appliedAt: now,
        approvedAt: '',
        approver: '',
        deletedAt: '',
        deleter: '',
        preferredShiftType: preferredResult.code,
        remarks: normalizeRemarks(remarks),
        email: trimmedEmail,
        reminderSentAt: '',
        cancelledAt: ''
      };

      slot.tentativeCount = Number(slot.tentativeCount) + 1;
      slot.updatedAt = now;

      SheetRepository.appendApplication(application);
      SheetRepository.updateSlotRow(found.rowIndex, slot);

      ChatNotify.notifyNewApplication(application);
      MailNotify.sendApplicationReceived(application);

      SpreadsheetApp.flush();
      OfficeManagerListService.refreshOfficeManagerListSafe();

      return Utils.success({
        applicationId: application.applicationId,
        message: '応募を受け付けました。管理者の承認をお待ちください。'
      });
    } catch (e) {
      return Utils.failure('応募処理中にエラーが発生しました: ' + e.message);
    } finally {
      if (hasLock) {
        lock.releaseLock();
      }
    }
  }

  function approveApplication(applicationId, approverName) {
    var lock = LockService.getScriptLock();
    var hasLock = false;
    try {
      lock.waitLock(30000);
      hasLock = true;

      var appFound = SheetRepository.findApplicationById(applicationId);
      if (!appFound) {
        return Utils.failure('応募が見つかりません。');
      }
      var app = appFound.application;

      if (app.status !== Config.APP_STATUS.PENDING) {
        return Utils.failure('承認待ちの応募のみ承認できます。');
      }

      var slotFound = SheetRepository.findSlotById(app.slotId);
      if (!slotFound) {
        return Utils.failure('募集枠が見つかりません。');
      }
      var slot = slotFound.slot;
      var now = Utils.now();
      var slotCode = Config.resolveShiftCode(slot.shiftType);
      var preferredCode = Config.getEffectivePreferredShiftCode(app);
      var shouldSplit = slotCode === 'FULLDAY' &&
        (preferredCode === 'AM' || preferredCode === 'PM');
      var confirmedShiftCode = getConfirmedShiftCodeForApproval(app, slot, shouldSplit);

      app.status = Config.APP_STATUS.APPROVED;
      app.approvedAt = now;
      app.approver = String(approverName || '管理者').trim() || '管理者';

      slot.tentativeCount = Math.max(0, Number(slot.tentativeCount) - 1);
      slot.approvedCount = Number(slot.approvedCount) + 1;
      slot.updatedAt = now;

      if (shouldSplit) {
        slot.shiftType = Config.getShiftTypeLabel(preferredCode);
      }

      SheetRepository.updateApplicationRow(appFound.rowIndex, app);
      SheetRepository.updateSlotRow(slotFound.rowIndex, slot);

      var splitInfo = null;
      if (shouldSplit) {
        var remainderShiftCode = preferredCode === 'AM' ? 'PM' : 'AM';
        SlotService.createRemainderHalfDaySlot(slot, remainderShiftCode);
        splitInfo = {
          confirmedShiftCode: preferredCode,
          remainderShiftCode: remainderShiftCode
        };
      }

      ChatNotify.notifyApproved(app, splitInfo);
      MailNotify.sendApplicationApproved(app, confirmedShiftCode);

      SpreadsheetApp.flush();
      OfficeListService.refreshOfficeListSafe();
      OfficeManagerListService.refreshOfficeManagerListSafe();

      return Utils.success({ applicationId: app.applicationId });
    } catch (e) {
      return Utils.failure('承認処理中にエラーが発生しました: ' + e.message);
    } finally {
      if (hasLock) {
        lock.releaseLock();
      }
    }
  }

  function getConfirmedShiftCodeFromSlot(slot) {
    return Config.resolveShiftCode(slot.shiftType);
  }

  function cancelApprovedApplication(applicationId, operatorName) {
    var lock = LockService.getScriptLock();
    var hasLock = false;
    try {
      lock.waitLock(30000);
      hasLock = true;

      var appFound = SheetRepository.findApplicationById(applicationId);
      if (!appFound) {
        return Utils.failure('応募が見つかりません。');
      }
      var app = appFound.application;

      if (app.status !== Config.APP_STATUS.APPROVED) {
        return Utils.failure('承認済みの応募のみキャンセルできます。');
      }

      var slotFound = SheetRepository.findSlotById(app.slotId);
      if (!slotFound) {
        return Utils.failure('募集枠が見つかりません。');
      }
      var slot = slotFound.slot;
      var confirmedShiftCode = getConfirmedShiftCodeFromSlot(slot);
      var now = Utils.now();

      app.status = Config.APP_STATUS.CANCELLED;
      app.cancelledAt = now;

      slot.tentativeCount = 0;
      slot.approvedCount = 0;
      slot.slotStatus = Config.SLOT_STATUS.OPEN;
      slot.updatedAt = now;

      SheetRepository.updateApplicationRow(appFound.rowIndex, app);
      SheetRepository.updateSlotRow(slotFound.rowIndex, slot);

      SpreadsheetApp.flush();
      OfficeListService.refreshOfficeListSafe();
      OfficeManagerListService.refreshOfficeManagerListSafe();

      ChatNotify.notifyCancelled(app, confirmedShiftCode);
      MailNotify.sendApplicationCancelled(app, confirmedShiftCode);

      return Utils.success({ applicationId: app.applicationId });
    } catch (e) {
      return Utils.failure('キャンセル処理中にエラーが発生しました: ' + e.message);
    } finally {
      if (hasLock) {
        lock.releaseLock();
      }
    }
  }

  function rejectApplication(applicationId, approverName) {
    var lock = LockService.getScriptLock();
    var hasLock = false;
    try {
      lock.waitLock(30000);
      hasLock = true;

      var appFound = SheetRepository.findApplicationById(applicationId);
      if (!appFound) {
        return Utils.failure('応募が見つかりません。');
      }
      var app = appFound.application;

      if (app.status !== Config.APP_STATUS.PENDING) {
        return Utils.failure('承認待ちの応募のみ否認できます。');
      }

      var slotFound = SheetRepository.findSlotById(app.slotId);
      if (!slotFound) {
        return Utils.failure('募集枠が見つかりません。');
      }
      var slot = slotFound.slot;
      var now = Utils.now();

      app.status = Config.APP_STATUS.REJECTED;
      app.approver = String(approverName || '管理者').trim() || '管理者';

      slot.tentativeCount = Math.max(0, Number(slot.tentativeCount) - 1);
      slot.updatedAt = now;

      SheetRepository.updateApplicationRow(appFound.rowIndex, app);
      SheetRepository.updateSlotRow(slotFound.rowIndex, slot);

      ChatNotify.notifyRejected(app);

      OfficeListService.refreshOfficeListSafe();
      OfficeManagerListService.refreshOfficeManagerListSafe();

      return Utils.success({ applicationId: app.applicationId });
    } catch (e) {
      return Utils.failure('否認処理中にエラーが発生しました: ' + e.message);
    } finally {
      if (hasLock) {
        lock.releaseLock();
      }
    }
  }

  function deleteApplication(applicationId, deleterName) {
    var lock = LockService.getScriptLock();
    var hasLock = false;
    try {
      lock.waitLock(30000);
      hasLock = true;

      var appFound = SheetRepository.findApplicationById(applicationId);
      if (!appFound) {
        return Utils.failure('応募が見つかりません。');
      }
      var app = appFound.application;

      if (app.status === Config.APP_STATUS.DELETED) {
        return Utils.failure('既に削除済みです。');
      }

      var slotFound = SheetRepository.findSlotById(app.slotId);
      if (!slotFound) {
        return Utils.failure('募集枠が見つかりません。');
      }
      var slot = slotFound.slot;
      var now = Utils.now();
      var previousStatus = app.status;

      app.status = Config.APP_STATUS.DELETED;
      app.deletedAt = now;
      app.deleter = String(deleterName || '管理者').trim() || '管理者';

      if (previousStatus === Config.APP_STATUS.PENDING) {
        slot.tentativeCount = Math.max(0, Number(slot.tentativeCount) - 1);
      } else if (previousStatus === Config.APP_STATUS.APPROVED) {
        slot.approvedCount = Math.max(0, Number(slot.approvedCount) - 1);
      }

      slot.updatedAt = now;

      SheetRepository.updateApplicationRow(appFound.rowIndex, app);
      SheetRepository.updateSlotRow(slotFound.rowIndex, slot);

      ChatNotify.notifyDeleted(app);

      OfficeListService.refreshOfficeListSafe();
      OfficeManagerListService.refreshOfficeManagerListSafe();

      return Utils.success({ applicationId: app.applicationId });
    } catch (e) {
      return Utils.failure('削除処理中にエラーが発生しました: ' + e.message);
    } finally {
      if (hasLock) {
        lock.releaseLock();
      }
    }
  }

  function getAllApplicationsForAdmin() {
    var apps = SheetRepository.getAllApplications()
      .sort(function (a, b) {
        var da = Utils.parseDate(a.appliedAt);
        var db = Utils.parseDate(b.appliedAt);
        return db.getTime() - da.getTime();
      })
      .map(mapApplicationForAdmin);
    return Utils.success(apps);
  }

  return {
    getStaffPageData: getStaffPageData,
    getAvailableSlotsForStaff: getAvailableSlotsForStaff,
    submitApplication: submitApplication,
    approveApplication: approveApplication,
    cancelApprovedApplication: cancelApprovedApplication,
    rejectApplication: rejectApplication,
    deleteApplication: deleteApplication,
    getAllApplicationsForAdmin: getAllApplicationsForAdmin
  };
})();
