(()=>{
const form=document.querySelector('#inquiry-form');if(!form)return;
const email=window.MOONBERRY_CONFIG?.contactEmail?.trim()||'';
const notice=document.querySelector('#booking-notice');
const submit=form.querySelector('button[type="submit"]');
if(!email){notice.textContent='The owner is setting up the business contact email. Packages are previews and bookings are not yet open.';return;}
notice.textContent='Your message will open in your email application. Nothing is sent by this website.';
form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;
const name=form.elements.parentName.value.trim(),kind=form.elements.package.value,details=form.elements.notes.value.trim();
const subject=encodeURIComponent('Birthday website enquiry — '+kind);
const body=encodeURIComponent(`Hello Moonberry Play Lab,\n\nI am interested in the ${kind} package.\n\nParent/guardian name: ${name}\nPreferred theme or questions (no child details needed yet): ${details}\n\nPlease tell me how to proceed.\n`);
window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
});
for(const control of form.elements)control.disabled=false;
submit.textContent='Send inquiry by email →';
})();
