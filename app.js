(() => {
  const $=id=>document.getElementById(id);
  const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
  const num=(id,f=0)=>{const el=$(id);const n=el?Number(el.value):f;return Number.isFinite(n)&&n>=0?n:f};

  function residentTax(income){
    income=Math.max(0,income);
    if(income<=18200)return 0;
    if(income<=45000)return (income-18200)*0.15;
    if(income<=135000)return 4020+(income-45000)*0.30;
    if(income<=190000)return 31020+(income-135000)*0.37;
    return 51370+(income-190000)*0.45;
  }
  function whmTax(income){
    income=Math.max(0,income);
    if(income<=45000)return income*0.15;
    if(income<=135000)return 6750+(income-45000)*0.30;
    if(income<=190000)return 33750+(income-135000)*0.37;
    return 54100+(income-190000)*0.45;
  }

  function buildPackage(p){
    const effectiveRate=p.baseRate*(p.casual?1+p.casualRate:1);
    const ordinaryPay=p.ordinaryHours*effectiveRate;
    const halfPay=p.halfHours*(Number.isFinite(p.halfRate)?p.halfRate:effectiveRate*1.5);
    const doublePay=p.doubleHours*(Number.isFinite(p.doubleRate)?p.doubleRate:effectiveRate*2);
    const wagesOnly=ordinaryPay+halfPay+doublePay;
    const totalHours=p.ordinaryHours+p.halfHours+p.doubleHours;
    const weeklyGross=wagesOnly+p.allowances;
    const leaveWeeks=p.casual?0:p.leaveWeeks;
    const workingWages=wagesOnly*p.billableWeeks;
    const annualAllowances=p.allowances*p.billableWeeks;
    const paidLeave=ordinaryPay*leaveWeeks;
    const leaveLoadingValue=paidLeave*(p.casual?0:p.leaveLoading);
    const publicHolidayHours=p.casual?0:(p.ordinaryHours/Math.max(1,p.workingDays))*p.publicHolidayDays;
    const publicHolidayValue=p.casual?0:publicHolidayHours*p.effectivePublicRate;
    const taxable=workingWages+annualAllowances+paidLeave+leaveLoadingValue;
    const incomeTax=p.whm?whmTax(taxable):residentTax(taxable);
    const medicare=p.whm?0:taxable*0.02;
    const totalTax=incomeTax+medicare;
    const annualAfterTax=Math.max(0,taxable-totalTax);
    const weeklySuper=ordinaryPay*p.superRate;
    const annualSuper=ordinaryPay*(p.billableWeeks+leaveWeeks)*p.superRate;
    const employmentValue=taxable+annualSuper;
    const payrollTaxValue=employmentValue*p.payrollTaxRate;
    const beforeOverhead=employmentValue+payrollTaxValue;
    const requiredRevenue=beforeOverhead/(1-Math.min(.95,p.overhead));
    const overheadValue=requiredRevenue-beforeOverhead;
    const annualBillableHours=Math.max(0,totalHours*p.billableWeeks-publicHolidayHours);
    const ptyRate=annualBillableHours>0?requiredRevenue/annualBillableHours:0;
    return {effectiveRate,ordinaryPay,halfPay,doublePay,wagesOnly,totalHours,weeklyGross,leaveWeeks,workingWages,annualAllowances,paidLeave,leaveLoadingValue,publicHolidayHours,publicHolidayValue,taxable,incomeTax,medicare,totalTax,annualAfterTax,weeklySuper,annualSuper,employmentValue,payrollTaxValue,beforeOverhead,requiredRevenue,overheadValue,annualBillableHours,ptyRate};
  }

  const payModes={f:'hourly',e:'hourly'};
  const hourlyValues={};
  function syncPayMode(prefix){
    const weekly=payModes[prefix]==='weekly';
    $(prefix+'HourlyField').hidden=weekly;
    $(prefix+'WeeklyField').hidden=!weekly;
    $(prefix+'CasualRate').disabled=weekly;
    let error='';
    if(weekly){
      const input=$(prefix+'WeeklyGrossInput');
      const gross=Number(input.value);
      const ordinaryHours=num(prefix+'OrdinaryHours');
      const overtimePay=num(prefix+'HalfHours')*num(prefix+'OvertimeRate')+num(prefix+'DoubleHours')*num(prefix+'DoubleTimeRate');
      const availableForOrdinary=gross-num(prefix+'Allowances')-overtimePay;
      if(input.value==='' || !Number.isFinite(gross) || gross<0) error='Enter gross wages of $0 or more.';
      else if(gross<num(prefix+'Allowances')) error='Allowances cannot exceed the gross weekly total.';
      else if(ordinaryHours<=0) error='Enter ordinary hours to calculate an equivalent base hourly rate.';
      else if(availableForOrdinary<0) error='The entered overtime pay and allowances exceed the gross weekly total.';
      if(!error){
        const loading=$(prefix+'Casual').checked?1+num(prefix+'CasualRate')/100:1;
        $(prefix+'Rate').value=availableForOrdinary/ordinaryHours/loading;
      }
      input.setAttribute('aria-invalid',error?'true':'false');
    }
    $(prefix+'PayError').textContent=error;
    $(prefix+'PayError').hidden=!error;
    const panel=$('panel-'+(prefix==='f'?'forward':'employer'));
    panel.querySelectorAll(':scope > .card').forEach((card,index)=>{if(index>0)card.hidden=!!error;});
    return !error;
  }
  document.querySelectorAll('[data-pay-mode]').forEach(button=>{
    button.addEventListener('click',()=>{
      const prefix=button.dataset.payPrefix,mode=button.dataset.payMode;
      if(mode===payModes[prefix])return;
      if(mode==='weekly'){
        hourlyValues[prefix]=$(prefix+'Rate').value;
        if($(prefix+'WeeklyGrossInput').value===''){
          const loading=$(prefix+'Casual').checked?1+num(prefix+'CasualRate')/100:1;
          const ordinaryPay=num(prefix+'Rate')*loading*num(prefix+'OrdinaryHours');
          const overtimePay=num(prefix+'OvertimeRate')*num(prefix+'HalfHours')+num(prefix+'DoubleTimeRate')*num(prefix+'DoubleHours');
          $(prefix+'WeeklyGrossInput').value=(ordinaryPay+overtimePay+num(prefix+'Allowances')).toFixed(2);
        }
      }else $(prefix+'Rate').value=hourlyValues[prefix];
      payModes[prefix]=mode;
      document.querySelectorAll('[data-pay-prefix="'+prefix+'"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.payMode===mode)));
      recalcAll();
    });
  });

  function forwardParams(){
    return {
      ordinaryHours:num('fOrdinaryHours'),baseRate:num('fRate'),halfHours:num('fHalfHours'),doubleHours:num('fDoubleHours'),
      halfRate:num('fOvertimeRate'),doubleRate:num('fDoubleTimeRate'),
      allowances:num('fAllowances'),casual:$('fCasual').checked,casualRate:num('fCasualRate')/100,whm:$('fWHM').checked,
      superRate:num('fSuperRate')/100,leaveWeeks:(num('fLeaveDays')/Math.max(1,num('fWorkingDays',5))),leaveLoading:num('fLeaveLoading')/100,
      publicHolidayDays:num('fPublicHolidayDays'),workingDays:Math.max(1,num('fWorkingDays',5)),effectivePublicRate:num('fRate')*( $('fCasual').checked ? 1+num('fCasualRate')/100 : 1 ),
      billableWeeks:Math.max(1,num('fBillableWeeks',48)),overhead:num('fOverhead')/100,payrollTaxRate:num('fPayrollTaxRate')/100
    };
  }

  function calcForward(){
    const p=forwardParams(),r=buildPackage(p);
    $('fTotalHours').textContent=r.totalHours.toFixed(1)+' hrs';
    $('fEffectiveRate').textContent=money(r.effectiveRate);
    $('fWeeklyPay').textContent=money(r.weeklyGross);
    $('fAverageHourly').textContent=r.totalHours?money(r.weeklyGross/r.totalHours):money(0);
    $('fOrdinaryPay').textContent=money(r.ordinaryPay);
    $('fHalfPay').textContent=money(r.halfPay);
    $('fDoublePay').textContent=money(r.doublePay);
    $('fAllowancePay').textContent=money(p.allowances);
    $('fWeeklySuper').textContent=money(r.weeklySuper)+'/wk';
    $('fOTEWeekly').textContent=money(r.ordinaryPay);
    $('fSuperRateDisplay').textContent=(p.superRate*100).toFixed(1).replace('.0','')+'%';
    $('fAnnualSuper').textContent=money(r.annualSuper);
    $('fTaxableIncome').textContent=money(r.taxable);
    $('fIncomeTax').textContent=money(r.incomeTax);
    $('fMedicare').textContent=money(r.medicare);
    $('fAnnualAfterTax').textContent=money(r.annualAfterTax);
    $('fAfterTaxWeekly').textContent=money(r.annualAfterTax/52);
    $('fWeeklyIncomeTax').textContent=money(r.incomeTax/52);
    $('fWeeklyMedicare').textContent=money(r.medicare/52);
    $('fWeeklyTotalTax').textContent=money(r.totalTax/52);
    $('fTaxModeText').textContent=p.whm
      ?'Working holiday maker tax mode is ON. This rough estimate applies 15% to the first $45,000, then 30%, 37% and 45% at the higher thresholds, and assumes no Medicare levy.'
      :'Australian resident tax mode is ON. This rough estimate uses the 2026–27 resident tax brackets plus an approximate 2% Medicare levy.';
    $('fPtyRate').textContent=money(r.ptyRate);
    $('fPtyWeekly').textContent=money(r.ptyRate*r.totalHours);
    $('fPtyAnnual').textContent=money(r.requiredRevenue);
    $('fWithGst').textContent=money(r.ptyRate*1.10);
    $('fAnnualWorkingWages').textContent=money(r.workingWages);
    $('fAnnualAllowances').textContent=money(r.annualAllowances);
    $('fPaidLeave').textContent=money(r.paidLeave);
    $('fPublicHolidayValue').textContent=money(r.publicHolidayValue);
    $('fPublicHolidayHours').textContent=r.publicHolidayHours.toFixed(1)+' hrs';
    $('fLeaveLoadingValue').textContent=money(r.leaveLoadingValue);
    $('fSuperValue').textContent=money(r.annualSuper);
    $('fEmploymentValue').textContent=money(r.employmentValue);
    $('fPayrollTaxValue').textContent=money(r.payrollTaxValue);
    $('fOverheadValue').textContent=money(r.overheadValue);
    $('fRequiredRevenue').textContent=money(r.requiredRevenue);
    $('fCasualNotice').hidden=!p.casual;
  }

  function reversePackage(baseRate){
    const p={
      ordinaryHours:num('rOrdinaryHours'),baseRate,halfHours:num('rHalfHours'),doubleHours:num('rDoubleHours'),
      halfRate:num('rTfnOvertimeRate'),doubleRate:num('rTfnDoubleTimeRate'),
      allowances:num('rAllowances'),casual:$('rCasual').checked,casualRate:num('rCasualRate')/100,whm:$('rWHM').checked,
      superRate:num('rSuperRate')/100,leaveWeeks:(num('rLeaveDays')/Math.max(1,num('rWorkingDays',5))),leaveLoading:num('rLeaveLoading')/100,
      publicHolidayDays:num('rPublicHolidayDays'),workingDays:Math.max(1,num('rWorkingDays',5)),effectivePublicRate:baseRate*( $('rCasual').checked ? 1+num('rCasualRate')/100 : 1 ),
      billableWeeks:Math.max(1,num('rBillableWeeks',48)),overhead:num('rOverhead')/100,payrollTaxRate:num('rPayrollTaxRate')/100
    };
    return {p,r:buildPackage(p)};
  }

  function calcReverse(){
    const ordinaryRate=num('rPtyRateInput');
    const halfRate=$('rPtyHalfRate').value.trim()===''?ordinaryRate:num('rPtyHalfRate');
    const doubleRate=$('rPtyDoubleRate').value.trim()===''?ordinaryRate:num('rPtyDoubleRate');
    const weeklyInvoice=ordinaryRate*num('rOrdinaryHours')+halfRate*num('rHalfHours')+doubleRate*num('rDoubleHours');
    const zero=reversePackage(0),one=reversePackage(1);
    const annualPtyRevenue=Math.max(0,weeklyInvoice*zero.p.billableWeeks-ordinaryRate*zero.r.publicHolidayHours);
    const revenuePerBaseDollar=one.r.requiredRevenue-zero.r.requiredRevenue;
    let error='';
    if(zero.r.totalHours<=0 || zero.r.annualBillableHours<=0) error='Enter working hours and enough billable weeks to calculate the TFN comparison.';
    else if(annualPtyRevenue<zero.r.requiredRevenue) error='The entered PTY/ABN revenue does not cover the TFN allowances and costs. Review the rates or comparison settings.';
    else if(revenuePerBaseDollar<=0) error='The entered hours and TFN overtime rates cannot determine a base rate. Review the comparison settings.';
    $('rComparisonError').textContent=error;
    $('rComparisonError').hidden=!error;
    $('panel-reverse').querySelectorAll(':scope > section.card').forEach((card,index)=>{if(index>0)card.hidden=!!error;});
    if(error)return;
    const base=Math.max(0,(annualPtyRevenue-zero.r.requiredRevenue)/revenuePerBaseDollar);
    const {p,r}=reversePackage(base);

    $('rTfnRate').textContent=money(base)+'/hr';
    $('rGrossWeek').textContent=money(r.weeklyGross);
    $('rPtyWeekly').textContent=money(weeklyInvoice);
    $('rPackageValue').textContent=money(r.employmentValue+r.payrollTaxValue);
    $('rTaxable').textContent=money(r.taxable);
    $('rTakeHomeWeekly').textContent=money(r.annualAfterTax/52);
    $('rWeeklyTax').textContent=money(r.totalTax/52);
    $('rWeeklySuper').textContent=money(r.weeklySuper);
    $('rAnnualSuper').textContent=money(r.annualSuper);
    $('rAnnualAfterTax').textContent=money(r.annualAfterTax);
    $('rAnnualPtyRevenue').textContent=money(annualPtyRevenue);
    $('rOverheadValue').textContent=money(annualPtyRevenue-(r.employmentValue+r.payrollTaxValue));
    $('rPayrollValue').textContent=money(r.payrollTaxValue);
    $('rPaidLeave').textContent=money(r.paidLeave);
    $('rPublicHolidayValue').textContent=money(r.publicHolidayValue);
    $('rPublicHolidayHours').textContent=r.publicHolidayHours.toFixed(1)+' hrs';
    $('rLeaveLoadingValue').textContent=money(r.leaveLoadingValue);
    $('rSuperValue').textContent=money(r.annualSuper);
  }

  function calcEmployer(){
    const baseRate=num('eRate'),ordinaryHours=num('eOrdinaryHours'),halfHours=num('eHalfHours'),doubleHours=num('eDoubleHours');
    const overtimeRate=num('eOvertimeRate'),doubleTimeRate=num('eDoubleTimeRate');
    const allowances=num('eAllowances'),casual=$('eCasual').checked,casualRate=num('eCasualRate')/100;
    const superRate=num('eSuperRate')/100,leaveWeeks=casual?0:(num('eLeaveDays')/Math.max(1,num('eWorkingDays',5))),leaveLoading=casual?0:num('eLeaveLoading')/100;
    const publicHolidayDays=casual?0:num('ePublicHolidayDays'),workingDays=Math.max(1,num('eWorkingDays',5));
    const billableWeeks=Math.max(1,num('eBillableWeeks',48)),workersComp=num('eWorkersComp')/100;
    const payrollTaxRate=num('ePayrollTaxRate')/100,otherRate=num('eOtherOverhead')/100,margin=Math.min(.95,num('eMargin')/100);

    const effectiveRate=baseRate*(casual?1+casualRate:1);
    const ordinaryPay=ordinaryHours*effectiveRate;
    const halfPay=halfHours*overtimeRate;
    const doublePay=doubleHours*doubleTimeRate;
    const wagesOnly=ordinaryPay+halfPay+doublePay;
    const weeklyGross=wagesOnly+allowances;
    const totalHours=ordinaryHours+halfHours+doubleHours;
    const workingWages=wagesOnly*billableWeeks;
    const annualAllowances=allowances*billableWeeks;
    const paidLeave=ordinaryPay*leaveWeeks;
    const leaveLoadingValue=paidLeave*leaveLoading;
    const publicHolidayHours=casual?0:(ordinaryHours/workingDays)*publicHolidayDays;
    const publicHolidayValue=casual?0:publicHolidayHours*effectiveRate;
    const annualWageCost=workingWages+annualAllowances+paidLeave+leaveLoadingValue;
    const annualSuper=ordinaryPay*(billableWeeks+leaveWeeks)*superRate;
    const coreCost=annualWageCost+annualSuper;
    const workersCompValue=coreCost*workersComp;
    const payrollValue=coreCost*payrollTaxRate;
    const otherValue=coreCost*otherRate;
    const annualCost=coreCost+workersCompValue+payrollValue+otherValue;
    const billableHours=Math.max(0,totalHours*billableWeeks-publicHolidayHours);
    const costHour=billableHours>0?annualCost/billableHours:0;
    const chargeRate=margin<.95?costHour/(1-margin):costHour;

    $('eChargeRate').textContent=money(chargeRate)+'/hr';
    $('eGrossWeek').textContent=money(weeklyGross);
    $('eAnnualCost').textContent=money(annualCost);
    $('eCostHour').textContent=money(costHour)+'/hr';
    $('eWithGst').textContent=money(chargeRate*1.10)+'/hr';
    $('eWorkingWages').textContent=money(workingWages);
    $('eAnnualAllowances').textContent=money(annualAllowances);
    $('ePaidLeave').textContent=money(paidLeave);
    $('ePublicHolidayValue').textContent=money(publicHolidayValue);
    $('ePublicHolidayHours').textContent=publicHolidayHours.toFixed(1)+' hrs';
    $('eLeaveLoadingValue').textContent=money(leaveLoadingValue);
    $('eSuperValue').textContent=money(annualSuper);
    $('eWorkersCompValue').textContent=money(workersCompValue);
    $('ePayrollValue').textContent=money(payrollValue);
    $('eOtherValue').textContent=money(otherValue);
    $('eTotalCost').textContent=money(annualCost);
  }

  function recalcAll(){if(syncPayMode('f'))calcForward();calcReverse();if(syncPayMode('e'))calcEmployer();}

  document.querySelectorAll('input').forEach(el=>{
    el.addEventListener('input',recalcAll);
    el.addEventListener('change',recalcAll);
  });

  document.querySelectorAll('.calc-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const target=btn.dataset.target;
      document.querySelectorAll('.calc-tab').forEach(b=>b.classList.toggle('active',b===btn));
      document.querySelectorAll('.calc-panel').forEach(panel=>panel.hidden=panel.id!=='panel-'+target);
    });
  });

  recalcAll();
})();
