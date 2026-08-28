/**
 * 募集枠サービス
 */
var SlotService = (function () {
  var SLOT_REQUIRED_COUNT = 1;

  var SLOT_COLORS = {
    available: {
      backgroundColor: '#e8f0fe',
      borderColor: '#1a73e8',
      textColor: '#1557b0'
    },
    tentative: {
      backgroundColor: '#fef7e0',
      borderColor: '#e37400',
      textColor: '#b06000'
    },
    approved: {
      backgroundColor: '#dff3e4',
      borderColor: '#4caf50',
      textColor: '#1b5e20'
    },
    inactive: {
      backgroundColor: '#f1f3f4',
      borderColor: '#9aa0a6',
      textColor: '#5f6368'
    }
  };

  function buildApplicationsBySlotMap(applications) {
    var map = {};
    applications.forEach(function (app) {
      if (!map[app.slotId]) {
        map[app.slotId] = [];
      }
      map[app.slotId].push(app);
    });
    return map;
  }

  function getSlotApplications(slotId, applicationsBySlot) {
    if (applicationsBySlot && applicationsBySlot[slotId]) {
      return applicationsBySlot[slotId];
    }
    return SheetRepository.getApplicationsBySlotId(slotId);
  }

  function getSlotDisplayInfo(slot, applications) {
    if (slot.slotStatus === Config.SLOT_STATUS.CLOSED) {
      return {
        displayState: 'inactive',
        applicantName: '',
        activeApplication: null
      };
    }

    var pending = applications.filter(function (app) {
      return app.status === Config.APP_STATUS.PENDING;
    });
    if (pending.length > 0) {
      return {
        displayState: 'tentative',
        applicantName: pending[0].name,
        activeApplication: pending[0]
      };
    }

    var approved = applications.filter(function (app) {
      return app.status === Config.APP_STATUS.APPROVED;
    });
    if (approved.length > 0) {
      return {
        displayState: 'approved',
        applicantName: approved[0].name,
        activeApplication: approved[0]
      };
    }

    return {
      displayState: 'available',
      applicantName: '',
      activeApplication: null
    };
  }

  function appendNurseConditionSuffix(title, slot) {
    if (slot.jobCondition === Config.JOB_CONDITION.NURSE) {
      return title + '｜看護師';
    }
    return title;
  }

  function appendPreferredShiftSuffix(title, slot, activeApplication, displayState) {
    if (displayState !== 'tentative' || !activeApplication) {
      return title;
    }
    var preferredCode = Config.getEffectivePreferredShiftCode(activeApplication);
    return title + Config.getPreferredShiftCalendarSuffix(slot.shiftType, preferredCode);
  }

  function buildShortTitle(slot, displayState, applicantName, activeApplication) {
    var shift = Config.getShiftTypeLabel(slot.shiftType);
    var title;
    switch (displayState) {
      case 'available':
        title = shift + '｜募集中';
        break;
      case 'tentative':
        title = shift + '｜仮押さえ ' + applicantName;
        break;
      case 'approved':
        title = shift + '｜' + applicantName;
        break;
      case 'inactive':
        title = shift + '｜停止';
        break;
      default:
        title = shift;
    }
    title = appendPreferredShiftSuffix(title, slot, activeApplication, displayState);
    return appendNurseConditionSuffix(title, slot);
  }

  function buildLongTitle(slot, displayState, applicantName, activeApplication) {
    return buildShortTitle(slot, displayState, applicantName, activeApplication);
  }

  function slotToEvent(slot, applicationsBySlot) {
    var applications = getSlotApplications(slot.slotId, applicationsBySlot);
    var displayInfo = getSlotDisplayInfo(slot, applications);
    var colors = SLOT_COLORS[displayInfo.displayState];
    var shortTitle = buildShortTitle(
      slot,
      displayInfo.displayState,
      displayInfo.applicantName,
      displayInfo.activeApplication
    );
    var longTitle = buildLongTitle(
      slot,
      displayInfo.displayState,
      displayInfo.applicantName,
      displayInfo.activeApplication
    );
    var remaining = Utils.remainingCount(
      slot.requiredCount,
      slot.tentativeCount,
      slot.approvedCount
    );

    return {
      id: slot.slotId,
      title: shortTitle,
      start: Utils.toDateKey(slot.workDate),
      allDay: true,
      backgroundColor: colors.backgroundColor,
      borderColor: colors.borderColor,
      textColor: colors.textColor,
      extendedProps: {
        slotId: slot.slotId,
        workDate: Utils.formatDate(slot.workDate),
        targetFacility: slot.targetFacility,
        applicableFacilities: slot.applicableFacilities,
        shiftType: Config.getShiftTypeLabel(slot.shiftType),
        shiftTypeStaffLabel: Config.getShiftTypeStaffLabel(slot.shiftType),
        jobCondition: slot.jobCondition,
        requiredCount: slot.requiredCount,
        tentativeCount: slot.tentativeCount,
        approvedCount: slot.approvedCount,
        remaining: remaining,
        slotStatus: slot.slotStatus,
        displayState: displayInfo.displayState,
        applicantName: displayInfo.applicantName,
        shortTitle: shortTitle,
        longTitle: longTitle,
        backgroundColor: colors.backgroundColor,
        borderColor: colors.borderColor,
        textColor: colors.textColor
      }
    };
  }

  function getSlotsForAdmin(facilityCode, startStr, endStr) {
    var facilityName = Config.getFacilityName(facilityCode);
    var start = startStr ? new Date(startStr) : null;
    var end = endStr ? new Date(endStr) : null;
    var applicationsBySlot = buildApplicationsBySlotMap(SheetRepository.getAllApplications());

    var slots = SheetRepository.getAllSlots().filter(function (slot) {
      if (slot.targetFacility !== facilityName) return false;
      var d = Utils.parseDate(slot.workDate);
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    return slots.map(function (slot) {
      return slotToEvent(slot, applicationsBySlot);
    });
  }

  function createRemainderHalfDaySlot(sourceSlot, remainderShiftCode) {
    var now = Utils.now();
    var remainderSlot = {
      slotId: Utils.generateId(),
      workDate: sourceSlot.workDate,
      targetFacility: sourceSlot.targetFacility,
      applicableFacilities: sourceSlot.applicableFacilities,
      shiftType: Config.getShiftTypeLabel(remainderShiftCode),
      jobCondition: sourceSlot.jobCondition,
      requiredCount: SLOT_REQUIRED_COUNT,
      tentativeCount: 0,
      approvedCount: 0,
      slotStatus: Config.SLOT_STATUS.OPEN,
      createdAt: now,
      updatedAt: now
    };
    SheetRepository.appendSlot(remainderSlot);
    return remainderSlot;
  }

  function createSlot(facilityCode, workDateStr, shiftLabel, jobCondition) {
    var facilityName = Config.getFacilityName(facilityCode);
    if (!facilityName || facilityName === facilityCode) {
      return Utils.failure('施設が正しく指定されていません。');
    }

    var applicableNames = Config.getApplicableFacilityNames(facilityCode);
    if (applicableNames.length === 0) {
      return Utils.failure('応募可能施設が設定されていません。施設マスタを確認してください。');
    }

    var workDate = Utils.parseDate(workDateStr);
    if (!workDate) {
      return Utils.failure('勤務日が正しくありません。');
    }

    var validConditions = [Config.JOB_CONDITION.ANY, Config.JOB_CONDITION.NURSE];
    if (validConditions.indexOf(jobCondition) === -1) {
      return Utils.failure('職種条件が正しくありません。');
    }

    var shift = Config.getActiveShiftTypesForCreate().find(function (s) {
      return s.label === shiftLabel;
    });
    if (!shift) {
      return Utils.failure('勤務区分が正しくありません。');
    }

    var now = Utils.now();
    var slot = {
      slotId: Utils.generateId(),
      workDate: workDate,
      targetFacility: facilityName,
      applicableFacilities: applicableNames.join(','),
      shiftType: shift.label,
      jobCondition: jobCondition,
      requiredCount: SLOT_REQUIRED_COUNT,
      tentativeCount: 0,
      approvedCount: 0,
      slotStatus: Config.SLOT_STATUS.OPEN,
      createdAt: now,
      updatedAt: now
    };

    SheetRepository.appendSlot(slot);
    ChatNotify.notifyNewSlot(slot);
    return Utils.success(slotToEvent(slot));
  }

  function getSlotDetail(slotId) {
    var found = SheetRepository.findSlotById(slotId);
    if (!found) {
      return Utils.failure('募集枠が見つかりません。');
    }
    var applications = SheetRepository.getApplicationsBySlotId(slotId).map(function (app) {
      var preferredCode = Config.getEffectivePreferredShiftCode(app);
      return {
        applicationId: app.applicationId,
        name: app.name,
        homeFacility: app.homeFacility,
        jobType: Config.getJobTypeLabel(app.jobType),
        workDate: Utils.formatDate(app.workDate),
        shiftType: Config.getShiftTypeLabel(app.shiftType),
        shiftTypeStaffLabel: Config.getShiftTypeStaffLabel(app.shiftType),
        preferredShiftType: preferredCode,
        preferredShiftDisplay: Config.getShiftTypeStaffLabel(preferredCode),
        remarks: app.remarks || '',
        remarksDisplay: app.remarks ? app.remarks : 'なし',
        workFacility: app.workFacility,
        status: app.status,
        appliedAt: Utils.formatDateTime(app.appliedAt),
        approvedAt: app.approvedAt ? Utils.formatDateTime(app.approvedAt) : '',
        approver: app.approver || ''
      };
    });

    return Utils.success({
      slot: slotToEvent(found.slot).extendedProps,
      applications: applications,
      canDeleteSlot: canDeleteSlot(slotId)
    });
  }

  var SLOT_DELETE_BLOCKED_MESSAGE =
    '応募者が存在するため、この募集は削除できません。先に応募処理を行ってください。';

  function canDeleteSlot(slotId) {
    var applications = SheetRepository.getApplicationsBySlotId(slotId);
    if (applications.length === 0) {
      return true;
    }
    return false;
  }

  function deleteSlot(slotId) {
    var lock = LockService.getScriptLock();
    var hasLock = false;
    try {
      lock.waitLock(30000);
      hasLock = true;

      var trimmedId = String(slotId || '').trim();
      if (!trimmedId) {
        return Utils.failure('募集枠IDが指定されていません。');
      }

      var found = SheetRepository.findSlotById(trimmedId);
      if (!found) {
        return Utils.failure('募集枠が見つかりません。');
      }

      var applications = SheetRepository.getApplicationsBySlotId(trimmedId);
      if (applications.length > 0) {
        return Utils.failure(SLOT_DELETE_BLOCKED_MESSAGE);
      }

      var deleted = SheetRepository.deleteSlotRow(trimmedId);
      if (!deleted) {
        return Utils.failure('募集枠の削除に失敗しました。');
      }

      return Utils.success({ slotId: trimmedId });
    } catch (e) {
      return Utils.failure('募集枠の削除中にエラーが発生しました: ' + e.message);
    } finally {
      if (hasLock) {
        lock.releaseLock();
      }
    }
  }

  return {
    getSlotsForAdmin: getSlotsForAdmin,
    createSlot: createSlot,
    createRemainderHalfDaySlot: createRemainderHalfDaySlot,
    getSlotDetail: getSlotDetail,
    deleteSlot: deleteSlot,
    slotToEvent: slotToEvent
  };
})();
