import test from "node:test";
import assert from "node:assert/strict";
import { requestId, validateShiftRequest, requestConflicts, requestConversion, buildShiftRequests, validateRequestBatch } from "../src/shift-requests.js";
import { workPeriod } from "../src/work.js";
import { validateBackup } from "../src/db.js";

const workplaces = [{ id: "cafe", name: "カフェ", hourlyWage: 1000, closingDay: 20 }];
const request = { id: requestId("cafe","2026-11-01"), workplaceId:"cafe",date:"2026-11-01",status:"work",start:"16:00",end:"21:00",breakMinutes:30,note:"希望",updatedAt:"2026-10-09" };

test("希望は締め日の翌日から次の締め日までを対象にする", () => {
  const period = workPeriod("2026-10",workplaces[0]);
  assert.deepEqual([period.start,period.end],["2026-10-21","2026-11-20"]);
  const endOfMonth = workPeriod("2028-01",{...workplaces[0],closingDay:31});
  assert.deepEqual([endOfMonth.start,endOfMonth.end],["2028-02-01","2028-02-29"]);
});
test("勤務・休み希望の検証と翌日終了を扱う", () => {
  assert.equal(validateShiftRequest(request,workplaces),null);
  assert.equal(validateShiftRequest({...request,status:"off",start:"",end:""},workplaces),null);
  assert.equal(validateShiftRequest({...request,start:"22:00",end:"03:00"},workplaces),null);
  assert.match(validateShiftRequest({...request,end:"16:00"},workplaces),/開始/);
  assert.match(validateShiftRequest({...request,workplaceId:"missing"},workplaces),/ID|勤務先/);
});
test("繰り返し・終日・日跨ぎの重複を判定し、境界で接するだけの予定を除外", () => {
  const event = {id:"event",title:"予定",date:request.date,allDay:false,start:"20:00",end:"22:00"};
  assert.equal(requestConflicts(request,[event]).length,1);
  assert.equal(requestConflicts(request,[{...event,start:"21:00"}]).length,0);
  assert.equal(requestConflicts(request,[{...event,allDay:true}]).length,1);
  assert.equal(requestConflicts(request,[{...event,date:"2026-10-25",repeatRule:"weekly"}]).length,1);
  assert.equal(requestConflicts({...request,status:"off"},[event]).length,0);
  const night = {...request,start:"22:00",end:"03:00"};
  assert.equal(requestConflicts(night,[{...event,date:"2026-11-02",start:"02:00",end:"04:00"}]).length,1);
  assert.equal(requestConflicts({...request,start:"01:00",end:"05:00"},[],[{...request,id:"shift",date:"2026-10-31",start:"23:00",end:"02:00"}]).length,1);
});
test("確定への変換は勤務希望だけを追加し、別勤務先・期間外・登録済みを除外", () => {
  const off = {...request,id:requestId("cafe","2026-11-02"),date:"2026-11-02",status:"off"};
  const result = requestConversion([request,off,{...request,date:"2026-12-01"},{...request,workplaceId:"other"}],[],"cafe","2026-10-21","2026-11-20");
  assert.equal(result.additions.length,1);
  assert.equal(result.additions[0].breakMinutes,30);
  assert.equal(result.additions[0].sourceRequestId,request.id);
  assert.equal(requestConversion([request],result.additions,"cafe","2026-10-21","2026-11-20").additions.length,0);
  assert.equal(requestConversion([request],[{...request,id:"manual"}],"cafe","2026-10-21","2026-11-20").additions.length,0);
  assert.equal(requestConflicts(request,[],result.additions).length,0);
});
test("新しい希望をバックアップへ含め、旧v6の読み込みを維持する", () => {
  const old = {format:"self-manager-backup",version:6,events:[],todos:[],wallets:[],transactions:[],fixedCosts:[],workplaces,workShifts:[],habits:[],habitRecords:[],checklists:[],shoppingItems:[],wishlistItems:[],memos:[],moneyCategories:[],eventCategories:[],memoFolders:[]};
  assert.equal(validateBackup(old),old);
  const latest = {...old,version:7,shiftRequests:[request]};
  assert.equal(validateBackup(latest),latest);
  assert.throws(() => validateBackup({...latest,shiftRequests:[request,request]}),/重複/);
  assert.throws(() => validateBackup({...latest,workplaces:[]}),/希望/);
});

test("一括入力は選択日ごとのIDを作り、重複日を除き作成日時を保持する", () => {
  const dates = ["2026-11-02", request.date, request.date];
  const records = buildShiftRequests({...request,note:"共通メモ"},dates,[{...request,createdAt:"old"}],"now");
  assert.deepEqual(records.map((item) => item.date),[request.date,"2026-11-02"]);
  assert.equal(records[0].createdAt,"old");
  assert.equal(records[1].createdAt,"now");
  assert.equal(records[1].id,requestId("cafe","2026-11-02"));
  assert.ok(records.every((item) => item.note === "共通メモ" && item.breakMinutes === 30));
  assert.equal(validateRequestBatch(records,workplaces,workPeriod("2026-10",workplaces[0])),null);
  const off = buildShiftRequests({...request,status:"off",start:"",end:"",breakMinutes:0},dates);
  assert.equal(validateRequestBatch(off,workplaces),null);
});
test("一括入力は不正な日・期間外・重複・別勤務先を全体で拒否する", () => {
  const period = workPeriod("2026-10",workplaces[0]);
  assert.match(validateRequestBatch([],workplaces,period),/日付/);
  assert.match(validateRequestBatch([request,{...request,id:requestId("cafe","2026-11-31"),date:"2026-11-31"}],workplaces,period),/不正/);
  assert.match(validateRequestBatch(buildShiftRequests(request,[request.date,"2026-11-21"]),workplaces,period),/期間/);
  assert.match(validateRequestBatch([request,request],workplaces,period),/不正/);
  const other = {...workplaces[0],id:"other"};
  assert.match(validateRequestBatch([request,{...request,workplaceId:"other",id:requestId("other",request.date)}],[...workplaces,other],period),/不正/);
});
