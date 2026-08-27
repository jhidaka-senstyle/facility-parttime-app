/**
 * エントリーポイント・API
 */

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  if (params.page === 'admin') {
    return HtmlService.createTemplateFromFile('admin')
      .evaluate()
      .setTitle('施設間バイト募集 - 管理者')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (params.facility) {
    var template = HtmlService.createTemplateFromFile('staff');
    template.facilityCode = params.facility;
    return template
      .evaluate()
      .setTitle('施設間バイト募集')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('施設間バイト募集')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** --- 管理者 API --- */

function apiGetAdminInitData() {
  return {
    success: true,
    data: {
      facilities: Config.ADMIN_FACILITIES,
      defaultFacility: Config.DEFAULT_ADMIN_FACILITY,
      shiftTypes: Config.getActiveShiftTypesForCreate().map(function (s) {
        return s.label;
      }),
      jobConditions: [Config.JOB_CONDITION.ANY, Config.JOB_CONDITION.NURSE]
    }
  };
}

function apiGetAdminCalendarEvents(facilityCode, start, end) {
  try {
    var events = SlotService.getSlotsForAdmin(facilityCode, start, end);
    return Utils.success(events);
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiCreateSlot(facilityCode, workDate, shiftType, jobCondition) {
  try {
    return SlotService.createSlot(facilityCode, workDate, shiftType, jobCondition);
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiGetSlotDetail(slotId) {
  try {
    return SlotService.getSlotDetail(slotId);
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiDeleteSlot(slotId) {
  try {
    return SlotService.deleteSlot(slotId);
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiGetAllApplications() {
  try {
    return ApplicationService.getAllApplicationsForAdmin();
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiApproveApplication(applicationId, approverName) {
  try {
    return ApplicationService.approveApplication(applicationId, approverName);
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiRejectApplication(applicationId, approverName) {
  try {
    return ApplicationService.rejectApplication(applicationId, approverName);
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiDeleteApplication(applicationId, deleterName) {
  try {
    return ApplicationService.deleteApplication(applicationId, deleterName);
  } catch (err) {
    return Utils.failure(err.message);
  }
}

/** --- スタッフ API --- */

function apiGetStaffInitData(facilityCode) {
  try {
    var facilityName = Config.getFacilityName(facilityCode);
    var master = SheetRepository.getFacilityMaster();
    var exists = master.some(function (f) {
      return f.code === facilityCode;
    });
    if (!exists) {
      return Utils.failure('指定された所属施設が見つかりません。');
    }
    return Utils.success({
      facilityCode: facilityCode,
      facilityName: facilityName,
      jobTypes: SheetRepository.getJobTypeMaster()
    });
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiGetStaffSlots(facilityCode) {
  try {
    return ApplicationService.getAvailableSlotsForStaff(facilityCode);
  } catch (err) {
    return Utils.failure(err.message);
  }
}

function apiSubmitApplication(facilityCode, slotId, name, jobType) {
  try {
    return ApplicationService.submitApplication(facilityCode, slotId, name, jobType);
  } catch (err) {
    return Utils.failure(err.message);
  }
}
