import { addDays, dateKey, isValidDateKey } from "./domain.js";
export const MONEY_CATEGORIES = {"food":"食費","transport":"交通","daily":"日用品","dining":"外食","leisure":"娯楽","housing":"住居","utilities":"光熱・通信","subscription":"サブスク","salary":"給与","other":"その他"};
export function validateWallet(value){
  if(value.id!=="cash"||!Number.isSafeInteger(value.openingBalance)||value.openingBalance<0||value.openingBalance>1e10)return "初期残高は0円以上の整数で入力してください。";
  return null;
}

export function validateTransaction(value){
  if(!value||!["income","expense"].includes(value.type))return "収入・支出を選択してください。";
  if(!Number.isSafeInteger(value.amount)||value.amount<1||value.amount>1e10)return "金額は1円以上の整数で入力してください。";
  if(!isValidDateKey(value.date))return "正しい日付を指定してください。";
  if(!["cash","other"].includes(value.paymentMethod))return "支払方法を選択してください。";
  if(!MONEY_CATEGORIES[value.category])return "カテゴリを選択してください。";
  if(typeof value.note!=="string"||value.note.length>2000)return "メモを確認してください。";
  return null;
}

export function cashBalance(wallet,transactions){
  return (wallet?.openingBalance||0)+transactions.filter((item)=>item.paymentMethod==="cash").reduce((sum,item)=>sum+(item.type==="income"?item.amount:-item.amount),0);
}

export function monthSummary(transactions,month){
  const records=transactions.filter((item)=>item.date.slice(0,7)===month);
  const income=records.filter((item)=>item.type==="income").reduce((sum,item)=>sum+item.amount,0);
  const expense=records.filter((item)=>item.type==="expense").reduce((sum,item)=>sum+item.amount,0);
  return {records,income,expense,net:income-expense};
}

export function validateFixedCost(value){
  if(!value?.title?.trim())return "名称を入力してください。";
  if(!Number.isSafeInteger(value.amount)||value.amount<1||value.amount>1e10)return "金額は1円以上の整数で入力してください。";
  if(!MONEY_CATEGORIES[value.category])return "カテゴリを選択してください。";
  if(!["monthly","yearly"].includes(value.cadence))return "支払い周期を選択してください。";
  if(!Number.isInteger(value.paymentDay)||value.paymentDay<1||value.paymentDay>31)return "支払日は1〜31日で指定してください。";
  if(!isValidDateKey(value.startDate))return "正しい開始日を指定してください。";
  if(value.endDate&&(!isValidDateKey(value.endDate)||value.endDate<value.startDate))return "終了日を確認してください。";
  if(value.paidDates&&(!Array.isArray(value.paidDates)||value.paidDates.some((date)=>!isValidDateKey(date))))return "支払い履歴が不正です。";
  if(value.reminderLead&&!["none","at","oneDay"].includes(value.reminderLead))return "リマインダーの設定が不正です。";
  return null;
}

export function fixedCostDueDate(record,month){
  if(!/^\d{4}-\d{2}$/.test(month))return null;
  const [year,number]=month.split("-").map(Number);
  if(number<1||number>12)return null;
  if(record.cadence==="yearly"&&Number(record.startDate?.slice(5,7))!==number)return null;
  if(record.cadence!=="yearly"&&record.cadence!=="monthly")return null;
  const day=Math.min(record.paymentDay,new Date(year,number,0).getDate());
  const due=`${month}-${String(day).padStart(2,"0")}`;
  if(due<record.startDate||(record.endDate&&due>record.endDate))return null;
  return due;
}

export function fixedCostsForDay(records,key){
  return records.filter((record)=>fixedCostDueDate(record,key.slice(0,7))===key).map((record)=>({...record,dueDate:key,paid:record.paidDates?.includes(key)||false}));
}

export function fixedCostSummary(records,month){
  const due=records.map((record)=>({record,dueDate:fixedCostDueDate(record,month)})).filter((item)=>item.dueDate);
  const dueTotal=due.reduce((sum,item)=>sum+item.record.amount,0);
  const paidTotal=due.filter((item)=>item.record.paidDates?.includes(item.dueDate)).reduce((sum,item)=>sum+item.record.amount,0);
  const [year,number]=month.split("-").map(Number);
  const first=`${month}-01`,last=`${month}-${String(new Date(year,number,0).getDate()).padStart(2,"0")}`;
  const active=records.filter((record)=>record.startDate<=last&&(!record.endDate||record.endDate>=first));
  const monthlyEquivalent=Math.round(active.reduce((sum,record)=>sum+(record.cadence==="monthly"?record.amount:record.amount/12),0));
  return {due,dueTotal,paidTotal,monthlyEquivalent};
}

export function fixedCostReminders(records,now=new Date()){
  const result=[],start=addDays(dateKey(now),-1);
  for(let i=0;i<10;i++){
    const key=addDays(start,i);
    for(const record of fixedCostsForDay(records,key)){
      if(!record.reminderLead||record.reminderLead==="none"||record.paid)continue;
      const [year,month,day]=key.split("-").map(Number);
      const scheduledAt=new Date(year,month-1,day,9);
      const triggerAt=new Date(scheduledAt.getTime()-(record.reminderLead==="oneDay"?86400000:0));
      if(triggerAt>=new Date(now.getTime()-86400000)&&triggerAt<=new Date(now.getTime()+7*86400000))result.push({kind:"fixedCost",id:record.id,title:record.title,occurrenceDate:key,scheduledAt,triggerAt});
    }
  }
  return result.sort((a,b)=>a.triggerAt-b.triggerAt);
}
