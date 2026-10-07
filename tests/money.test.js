import test from "node:test";
import assert from "node:assert/strict";
import { cashBalance, fixedCostDueDate, fixedCostsForDay, fixedCostSummary, monthSummary, validateFixedCost, validateTransaction, fixedCostReminders } from "../src/money.js";
import { validateBackup } from "../src/db.js";

test("現金の収支だけが財布残高を変え、家計簿には両方載る", () => {
  const wallet={id:"cash",openingBalance:10000};
  const transactions=[
    {type:"expense",amount:580,date:"2026-09-27",paymentMethod:"cash",category:"food",note:""},
    {type:"expense",amount:1200,date:"2026-09-27",paymentMethod:"other",category:"dining",note:""},
    {type:"income",amount:3000,date:"2026-09-28",paymentMethod:"cash",category:"salary",note:""}
  ];
  assert.equal(cashBalance(wallet,transactions),12420);
  const month=monthSummary(transactions,"2026-09");
  assert.equal(month.income,3000);
  assert.equal(month.expense,1780);
  assert.equal(cashBalance(wallet,[...transactions,{type:"expense",amount:500,date:"2026-09-28",paymentMethod:"other"}]),12420);
});

test("固定費の支払い済みは財布と独立し、月末と年額を計算する", () => {
  const monthly={id:"m",title:"通信費",amount:3000,category:"utilities",cadence:"monthly",paymentDay:31,startDate:"2026-01-01",endDate:"",paidDates:["2026-02-28"],reminderLead:"none"};
  const yearly={id:"y",title:"年会費",amount:12000,category:"subscription",cadence:"yearly",paymentDay:28,startDate:"2026-02-01",endDate:"",paidDates:[],reminderLead:"none"};
  assert.equal(fixedCostDueDate(monthly,"2026-02"),"2026-02-28");
  assert.equal(fixedCostDueDate(yearly,"2026-03"),null);
  assert.equal(fixedCostsForDay([monthly,yearly],"2026-02-28").length,2);
  const summary=fixedCostSummary([monthly,yearly],"2026-02");
  assert.equal(summary.dueTotal,15000);
  assert.equal(summary.paidTotal,3000);
  assert.equal(summary.monthlyEquivalent,4000);
  assert.equal(cashBalance({openingBalance:10000},[]),10000);
});

test("固定費の開始・終了とバックアップv2を検証する", () => {
  const fixed={id:"f",title:"家賃",amount:45000,category:"housing",cadence:"monthly",paymentDay:5,startDate:"2026-05-06",endDate:"2026-07-31",paidDates:[],reminderLead:"at",note:""};
  assert.equal(fixedCostDueDate(fixed,"2026-05"),null);
  assert.equal(fixedCostDueDate(fixed,"2026-06"),"2026-06-05");
  assert.equal(fixedCostDueDate(fixed,"2026-08"),null);
  assert.equal(validateFixedCost(fixed),null);
  assert.match(validateTransaction({type:"expense",amount:0,date:"2026-09-27",paymentMethod:"cash",category:"food",note:""}),/金額/);
  const backup={format:"self-manager-backup",version:2,events:[],todos:[],wallets:[{id:"cash",openingBalance:10000}],transactions:[],fixedCosts:[fixed]};
  assert.equal(validateBackup(backup),backup);
  assert.throws(()=>validateBackup({...backup,wallets:[{id:"cash",openingBalance:-1}]}),/財布/);
});

test("固定費リマインダーは未払いの支払日から導出する", () => {
  const now=new Date(2026,8,27,8,0);
  const fixed={id:"f",title:"通信費",amount:3000,category:"utilities",cadence:"monthly",paymentDay:28,startDate:"2026-01-01",endDate:"",paidDates:[],reminderLead:"oneDay"};
  const reminders=fixedCostReminders([fixed],now);
  assert.equal(reminders.length,1);
  assert.equal(reminders[0].occurrenceDate,"2026-09-28");
  assert.equal(fixedCostReminders([{...fixed,paidDates:["2026-09-28"]}],now).length,0);
});
