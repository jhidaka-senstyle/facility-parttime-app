/**
 * 応募サービス
 */
var ApplicationService = (function () {
  function hasActiveApplication(slotId) {
    return SheetRepository.getApplicationsBySlotId(slotId).some(function (app) {
      return app.status === Config.APP_STATUS.PENDING ||
        app.status === Config.APP_STATUS.APPROVED;
    });
  }

  function canStaffSeeSlot(slot, staffFacilityName) {
    if (Utils.isPastDate(slot.workDate)) return false;

    var applicable = slot.applicableFacilities.split(',').map(function (s) {
      return s.trim();
    });
    if (applicable.indexOf(staffFacilityName) === -1) return false;

    if (slot.slotStatus === Config.SLOT_STATUS.CLOSED) return false;

    if (hasActiveApplication(slot.slotId)) return false;

    var remaining = Utils.remainingCount(
      slot.requiredCount,
      slot.tentativeCount,
      slot.approvedCount
    );
    return remaining > 0;
  }

  function slotToStaffCard(slot) {
    return {
      slotId: slot.slotId,
      workDate: Utils.formatDate(slot.workDate),
      workDateKey: Utils.toDateKey(slot.workDate),
      workFacility: slot.targetFacility,
      shiftType: Config.getShiftTypeLabel(slot.shiftType),
      shiftDisplay: Config.getShiftTypeStaffLabel(slot.shiftType),
      jobCondition: slot.jobCondition
    };
  }

  function getAvailableSlotsForStaff(facilityCode) {
    var facilityName = Config.getFacilityName(facilityCode);
    if (!facilityName || facilityName === facilityCode) {
      return Utils.failure('所属施設が正しく指定されていません。');
    }

    var slots = SheetRepository.getAllSlots()
      .filter(function (slot) {
        return canStaffSeeSlot(slot, facilityName);
      })
      .sort(function (a, b) {
        var da = Utils.parseDate(a.workDate);
        var db = Utils.parseDate(b.workDate);
        if (da.getTime() !== db.getTime()) {
          return da.getTime() - db.getTime();
        }
        return Config.getShiftTypeLabel(a.shiftType).localeCompare(
          Config.getShiftTypeLabel(b.shiftType), 'ja');
      })
      .map(slotToStaffCard);

    return Utils.success({
      facilityCode: facilityCode,
      facilityName: facilityName,
      slots: slots
    });
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

  function submitApplication(facilityCode, slotId, name, jobType) {
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
        deleter: ''
      };

      slot.tentativeCount = Number(slot.tentativeCount) + 1;
      slot.updatedAt = now;

      SheetRepository.appendApplication(application);
      SheetRepository.updateSlotRow(found.rowIndex, slot);

      ChatNotify.notifyNewApplication(application);

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

      app.status = Config.APP_STATUS.APPROVED;
      app.approvedAt = now;
      app.approver = String(approverName || '管理者').trim() || '管理者';

      slot.tentativeCount = Math.max(0, Number(slot.tentativeCount) - 1);
      slot.approvedCount = Number(slot.approvedCount) + 1;
      slot.updatedAt = now;

      SheetRepository.updateApplicationRow(appFound.rowIndex, app);
      SheetRepository.updateSlotRow(slotFound.rowIndex, slot);

      ChatNotify.notifyApproved(app);

      return Utils.success({ applicationId: app.applicationId });
    } catch (e) {
      return Utils.failure('承認処理中にエラーが発生しました: ' + e.message);
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
      .map(function (app) {
        return {
          applicationId: app.applicationId,
          slotId: app.slotId,
          name: app.name,
          homeFacility: app.homeFacility,
          jobType: Config.getJobTypeLabel(app.jobType),
          workDate: Utils.formatDate(app.workDate),
          shiftType: Config.getShiftTypeLabel(app.shiftType),
          workFacility: app.workFacility,
          status: app.status,
          appliedAt: Utils.formatDateTime(app.appliedAt)
        };
      });
    return Utils.success(apps);
  }

  return {
    getAvailableSlotsForStaff: getAvailableSlotsForStaff,
    submitApplication: submitApplication,
    approveApplication: approveApplication,
    rejectApplication: rejectApplication,
    deleteApplication: deleteApplication,
    getAllApplicationsForAdmin: getAllApplicationsForAdmin
  };
})();
