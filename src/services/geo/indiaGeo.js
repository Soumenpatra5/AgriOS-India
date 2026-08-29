/* India administrative dataset — States/UTs and their districts.
   ---------------------------------------------------------------------------
   DATASET PROVENANCE

     source        Compiled by hand from general knowledge of Indian
                   administrative divisions. NOT taken from an authoritative
                   register.
     verified      NO. See the warning below.
     version       2026.08.29
     lastUpdated   2026-08-29
     canonical     Local Government Directory (lgdirectory.gov.in) is the
                   government's own register and is what this should be
                   replaced with.

   READ THIS BEFORE TRUSTING A DISTRICT NAME
   -----------------------------------------
   The 36 States and Union Territories are stable and correct — that list
   changes about once a decade.

   The DISTRICT lists are best-effort and certainly contain errors. India has
   roughly 780 districts and the set changes several times a year: Chhattisgarh
   added a batch in 2022, Andhra Pradesh reorganised from 13 to 26 the same
   year, and Rajasthan created 19 districts in 2023 of which several were later
   scrapped. Some districts here will be missing, some renamed ones may appear
   under an old name, and a few may no longer exist.

   Because of that, `DATASET.verified` is false and the UI says so. This exists
   so a farmer picks from a list instead of typing free text — which is already
   a large improvement over what it replaces — not so the app can claim to know
   India's administrative geography.

   Rajasthan deliberately lists the long-standing 33 rather than the contested
   2023 set: an over-claimed district is worse than a missing one, since the
   picker allows a manual entry and a wrong entry looks authoritative.

   REPLACING THIS FILE
   -------------------
   Nothing outside geoService.js reads this shape. Swap the export for an LGD
   extract, keep `code` values, bump `version`, set `verified: true`, and no
   component changes. Renamed districts go in ALIASES so saved IDs keep
   resolving.
*/

export const DATASET = {
  source: "hand-compiled, unverified",
  canonicalSource: "https://lgdirectory.gov.in",
  version: "2026.08.29",
  lastUpdated: "2026-08-29",
  /* Flipping this to true is a claim that the districts were checked against
     the canonical register. The UI shows a caveat while it is false. */
  verified: false,
};

export const COUNTRIES = [
  { id: "IN", code: "IN", name: "India", i18n: { en: "India", hi: "भारत", bn: "ভারত" } },
];

export const DEFAULT_COUNTRY_ID = "IN";

/* `code` is the ISO 3166-2 subdivision code without the "IN-" prefix. It is
   externally defined and survives renames, which is why it — not the name — is
   the stable half of the identifier. */
const S = (code, name, type, districts) => ({ code, name, type, districts });

export const STATES_RAW = [
  S("AP", "Andhra Pradesh", "state", "Alluri Sitharama Raju|Anakapalli|Ananthapuramu|Annamayya|Bapatla|Chittoor|Dr. B.R. Ambedkar Konaseema|East Godavari|Eluru|Guntur|Kakinada|Krishna|Kurnool|Nandyal|NTR|Palnadu|Parvathipuram Manyam|Prakasam|Sri Potti Sriramulu Nellore|Sri Sathya Sai|Srikakulam|Tirupati|Visakhapatnam|Vizianagaram|West Godavari|YSR Kadapa"),
  S("AR", "Arunachal Pradesh", "state", "Anjaw|Changlang|Dibang Valley|East Kameng|East Siang|Kamle|Kra Daadi|Kurung Kumey|Lepa Rada|Lohit|Longding|Lower Dibang Valley|Lower Siang|Lower Subansiri|Namsai|Pakke-Kessang|Papum Pare|Shi Yomi|Siang|Tawang|Tirap|Upper Siang|Upper Subansiri|West Kameng|West Siang"),
  S("AS", "Assam", "state", "Bajali|Baksa|Barpeta|Biswanath|Bongaigaon|Cachar|Charaideo|Chirang|Darrang|Dhemaji|Dhubri|Dibrugarh|Dima Hasao|Goalpara|Golaghat|Hailakandi|Hojai|Jorhat|Kamrup|Kamrup Metropolitan|Karbi Anglong|Karimganj|Kokrajhar|Lakhimpur|Majuli|Morigaon|Nagaon|Nalbari|Sivasagar|Sonitpur|South Salmara-Mankachar|Tamulpur|Tinsukia|Udalguri|West Karbi Anglong"),
  S("BR", "Bihar", "state", "Araria|Arwal|Aurangabad|Banka|Begusarai|Bhagalpur|Bhojpur|Buxar|Darbhanga|East Champaran|Gaya|Gopalganj|Jamui|Jehanabad|Kaimur|Katihar|Khagaria|Kishanganj|Lakhisarai|Madhepura|Madhubani|Munger|Muzaffarpur|Nalanda|Nawada|Patna|Purnia|Rohtas|Saharsa|Samastipur|Saran|Sheikhpura|Sheohar|Sitamarhi|Siwan|Supaul|Vaishali|West Champaran"),
  S("CT", "Chhattisgarh", "state", "Balod|Baloda Bazar|Balrampur|Bastar|Bemetara|Bijapur|Bilaspur|Dantewada|Dhamtari|Durg|Gariaband|Gaurela-Pendra-Marwahi|Janjgir-Champa|Jashpur|Kabirdham|Kanker|Khairagarh-Chhuikhadan-Gandai|Kondagaon|Korba|Koriya|Mahasamund|Manendragarh-Chirmiri-Bharatpur|Mohla-Manpur-Ambagarh Chowki|Mungeli|Narayanpur|Raigarh|Raipur|Rajnandgaon|Sakti|Sarangarh-Bilaigarh|Sukma|Surajpur|Surguja"),
  S("GA", "Goa", "state", "North Goa|South Goa"),
  S("GJ", "Gujarat", "state", "Ahmedabad|Amreli|Anand|Aravalli|Banaskantha|Bharuch|Bhavnagar|Botad|Chhota Udaipur|Dahod|Dang|Devbhoomi Dwarka|Gandhinagar|Gir Somnath|Jamnagar|Junagadh|Kheda|Kutch|Mahisagar|Mehsana|Morbi|Narmada|Navsari|Panchmahal|Patan|Porbandar|Rajkot|Sabarkantha|Surat|Surendranagar|Tapi|Vadodara|Valsad"),
  S("HR", "Haryana", "state", "Ambala|Bhiwani|Charkhi Dadri|Faridabad|Fatehabad|Gurugram|Hisar|Jhajjar|Jind|Kaithal|Karnal|Kurukshetra|Mahendragarh|Nuh|Palwal|Panchkula|Panipat|Rewari|Rohtak|Sirsa|Sonipat|Yamunanagar"),
  S("HP", "Himachal Pradesh", "state", "Bilaspur|Chamba|Hamirpur|Kangra|Kinnaur|Kullu|Lahaul and Spiti|Mandi|Shimla|Sirmaur|Solan|Una"),
  S("JH", "Jharkhand", "state", "Bokaro|Chatra|Deoghar|Dhanbad|Dumka|East Singhbhum|Garhwa|Giridih|Godda|Gumla|Hazaribagh|Jamtara|Khunti|Koderma|Latehar|Lohardaga|Pakur|Palamu|Ramgarh|Ranchi|Sahibganj|Seraikela-Kharsawan|Simdega|West Singhbhum"),
  S("KA", "Karnataka", "state", "Bagalkot|Ballari|Belagavi|Bengaluru Rural|Bengaluru Urban|Bidar|Chamarajanagar|Chikkaballapur|Chikkamagaluru|Chitradurga|Dakshina Kannada|Davanagere|Dharwad|Gadag|Hassan|Haveri|Kalaburagi|Kodagu|Kolar|Koppal|Mandya|Mysuru|Raichur|Ramanagara|Shivamogga|Tumakuru|Udupi|Uttara Kannada|Vijayanagara|Vijayapura|Yadgir"),
  S("KL", "Kerala", "state", "Alappuzha|Ernakulam|Idukki|Kannur|Kasaragod|Kollam|Kottayam|Kozhikode|Malappuram|Palakkad|Pathanamthitta|Thiruvananthapuram|Thrissur|Wayanad"),
  S("MP", "Madhya Pradesh", "state", "Agar Malwa|Alirajpur|Anuppur|Ashoknagar|Balaghat|Barwani|Betul|Bhind|Bhopal|Burhanpur|Chhatarpur|Chhindwara|Damoh|Datia|Dewas|Dhar|Dindori|Guna|Gwalior|Harda|Indore|Jabalpur|Jhabua|Katni|Khandwa|Khargone|Maihar|Mandla|Mandsaur|Mauganj|Morena|Narmadapuram|Narsinghpur|Neemuch|Niwari|Pandhurna|Panna|Raisen|Rajgarh|Ratlam|Rewa|Sagar|Satna|Sehore|Seoni|Shahdol|Shajapur|Sheopur|Shivpuri|Sidhi|Singrauli|Tikamgarh|Ujjain|Umaria|Vidisha"),
  S("MH", "Maharashtra", "state", "Ahmednagar|Akola|Amravati|Beed|Bhandara|Buldhana|Chandrapur|Chhatrapati Sambhajinagar|Dharashiv|Dhule|Gadchiroli|Gondia|Hingoli|Jalgaon|Jalna|Kolhapur|Latur|Mumbai City|Mumbai Suburban|Nagpur|Nanded|Nandurbar|Nashik|Palghar|Parbhani|Pune|Raigad|Ratnagiri|Sangli|Satara|Sindhudurg|Solapur|Thane|Wardha|Washim|Yavatmal"),
  S("MN", "Manipur", "state", "Bishnupur|Chandel|Churachandpur|Imphal East|Imphal West|Jiribam|Kakching|Kamjong|Kangpokpi|Noney|Pherzawl|Senapati|Tamenglong|Tengnoupal|Thoubal|Ukhrul"),
  S("ML", "Meghalaya", "state", "East Garo Hills|East Jaintia Hills|East Khasi Hills|Eastern West Khasi Hills|North Garo Hills|Ri Bhoi|South Garo Hills|South West Garo Hills|South West Khasi Hills|West Garo Hills|West Jaintia Hills|West Khasi Hills"),
  S("MZ", "Mizoram", "state", "Aizawl|Champhai|Hnahthial|Khawzawl|Kolasib|Lawngtlai|Lunglei|Mamit|Saiha|Saitual|Serchhip"),
  S("NL", "Nagaland", "state", "Chumoukedima|Dimapur|Kiphire|Kohima|Longleng|Mokokchung|Mon|Niuland|Noklak|Peren|Phek|Shamator|Tseminyu|Tuensang|Wokha|Zunheboto"),
  S("OR", "Odisha", "state", "Angul|Balangir|Balasore|Bargarh|Bhadrak|Boudh|Cuttack|Deogarh|Dhenkanal|Gajapati|Ganjam|Jagatsinghpur|Jajpur|Jharsuguda|Kalahandi|Kandhamal|Kendrapara|Kendujhar|Khordha|Koraput|Malkangiri|Mayurbhanj|Nabarangpur|Nayagarh|Nuapada|Puri|Rayagada|Sambalpur|Subarnapur|Sundargarh"),
  S("PB", "Punjab", "state", "Amritsar|Barnala|Bathinda|Faridkot|Fatehgarh Sahib|Fazilka|Ferozepur|Gurdaspur|Hoshiarpur|Jalandhar|Kapurthala|Ludhiana|Malerkotla|Mansa|Moga|Muktsar|Pathankot|Patiala|Rupnagar|Sahibzada Ajit Singh Nagar|Sangrur|Shahid Bhagat Singh Nagar|Tarn Taran"),
  S("RJ", "Rajasthan", "state", "Ajmer|Alwar|Banswara|Baran|Barmer|Bharatpur|Bhilwara|Bikaner|Bundi|Chittorgarh|Churu|Dausa|Dholpur|Dungarpur|Ganganagar|Hanumangarh|Jaipur|Jaisalmer|Jalore|Jhalawar|Jhunjhunu|Jodhpur|Karauli|Kota|Nagaur|Pali|Pratapgarh|Rajsamand|Sawai Madhopur|Sikar|Sirohi|Tonk|Udaipur"),
  S("SK", "Sikkim", "state", "Gangtok|Gyalshing|Mangan|Namchi|Pakyong|Soreng"),
  S("TN", "Tamil Nadu", "state", "Ariyalur|Chengalpattu|Chennai|Coimbatore|Cuddalore|Dharmapuri|Dindigul|Erode|Kallakurichi|Kanchipuram|Kanyakumari|Karur|Krishnagiri|Madurai|Mayiladuthurai|Nagapattinam|Namakkal|Nilgiris|Perambalur|Pudukkottai|Ramanathapuram|Ranipet|Salem|Sivaganga|Tenkasi|Thanjavur|Theni|Thoothukudi|Tiruchirappalli|Tirunelveli|Tirupathur|Tiruppur|Tiruvallur|Tiruvannamalai|Tiruvarur|Vellore|Viluppuram|Virudhunagar"),
  S("TG", "Telangana", "state", "Adilabad|Bhadradri Kothagudem|Hanumakonda|Hyderabad|Jagtial|Jangaon|Jayashankar Bhupalpally|Jogulamba Gadwal|Kamareddy|Karimnagar|Khammam|Komaram Bheem Asifabad|Mahabubabad|Mahabubnagar|Mancherial|Medak|Medchal-Malkajgiri|Mulugu|Nagarkurnool|Nalgonda|Narayanpet|Nirmal|Nizamabad|Peddapalli|Rajanna Sircilla|Rangareddy|Sangareddy|Siddipet|Suryapet|Vikarabad|Wanaparthy|Warangal|Yadadri Bhuvanagiri"),
  S("TR", "Tripura", "state", "Dhalai|Gomati|Khowai|North Tripura|Sepahijala|South Tripura|Unakoti|West Tripura"),
  S("UP", "Uttar Pradesh", "state", "Agra|Aligarh|Ambedkar Nagar|Amethi|Amroha|Auraiya|Ayodhya|Azamgarh|Baghpat|Bahraich|Ballia|Balrampur|Banda|Barabanki|Bareilly|Basti|Bhadohi|Bijnor|Budaun|Bulandshahr|Chandauli|Chitrakoot|Deoria|Etah|Etawah|Farrukhabad|Fatehpur|Firozabad|Gautam Buddha Nagar|Ghaziabad|Ghazipur|Gonda|Gorakhpur|Hamirpur|Hapur|Hardoi|Hathras|Jalaun|Jaunpur|Jhansi|Kannauj|Kanpur Dehat|Kanpur Nagar|Kasganj|Kaushambi|Kheri|Kushinagar|Lalitpur|Lucknow|Maharajganj|Mahoba|Mainpuri|Mathura|Mau|Meerut|Mirzapur|Moradabad|Muzaffarnagar|Pilibhit|Pratapgarh|Prayagraj|Raebareli|Rampur|Saharanpur|Sambhal|Sant Kabir Nagar|Shahjahanpur|Shamli|Shravasti|Siddharthnagar|Sitapur|Sonbhadra|Sultanpur|Unnao|Varanasi"),
  S("UT", "Uttarakhand", "state", "Almora|Bageshwar|Chamoli|Champawat|Dehradun|Haridwar|Nainital|Pauri Garhwal|Pithoragarh|Rudraprayag|Tehri Garhwal|Udham Singh Nagar|Uttarkashi"),
  S("WB", "West Bengal", "state", "Alipurduar|Bankura|Birbhum|Cooch Behar|Dakshin Dinajpur|Darjeeling|Hooghly|Howrah|Jalpaiguri|Jhargram|Kalimpong|Kolkata|Malda|Murshidabad|Nadia|North 24 Parganas|Paschim Bardhaman|Paschim Medinipur|Purba Bardhaman|Purba Medinipur|Purulia|South 24 Parganas|Uttar Dinajpur"),

  S("AN", "Andaman and Nicobar Islands", "ut", "Nicobar|North and Middle Andaman|South Andaman"),
  S("CH", "Chandigarh", "ut", "Chandigarh"),
  S("DH", "Dadra and Nagar Haveli and Daman and Diu", "ut", "Dadra and Nagar Haveli|Daman|Diu"),
  S("DL", "Delhi", "ut", "Central Delhi|East Delhi|New Delhi|North Delhi|North East Delhi|North West Delhi|Shahdara|South Delhi|South East Delhi|South West Delhi|West Delhi"),
  S("JK", "Jammu and Kashmir", "ut", "Anantnag|Bandipora|Baramulla|Budgam|Doda|Ganderbal|Jammu|Kathua|Kishtwar|Kulgam|Kupwara|Poonch|Pulwama|Rajouri|Ramban|Reasi|Samba|Shopian|Srinagar|Udhampur"),
  S("LA", "Ladakh", "ut", "Kargil|Leh"),
  S("LD", "Lakshadweep", "ut", "Lakshadweep"),
  S("PY", "Puducherry", "ut", "Karaikal|Mahe|Puducherry|Yanam"),
];

/* Renamed or merged units, so an ID saved before the change still resolves.
   Key is the old id, value the current one. Add here rather than editing a
   name in place — editing in place silently orphans every saved record. */
export const ALIASES = {
  "IN-MH-osmanabad": "IN-MH-dharashiv",
  "IN-MH-aurangabad": "IN-MH-chhatrapati-sambhajinagar",
  "IN-UP-allahabad": "IN-UP-prayagraj",
  "IN-UP-faizabad": "IN-UP-ayodhya",
  "IN-KA-bangalore-urban": "IN-KA-bengaluru-urban",
  "IN-KA-bangalore-rural": "IN-KA-bengaluru-rural",
  "IN-KA-mysore": "IN-KA-mysuru",
  "IN-KA-bellary": "IN-KA-ballari",
  "IN-KA-gulbarga": "IN-KA-kalaburagi",
  "IN-KA-bijapur": "IN-KA-vijayapura",
  "IN-KA-shimoga": "IN-KA-shivamogga",
  "IN-KA-tumkur": "IN-KA-tumakuru",
  "IN-WB-burdwan": "IN-WB-purba-bardhaman",
  "IN-OR-keonjhar": "IN-OR-kendujhar",
  "IN-MP-hoshangabad": "IN-MP-narmadapuram",
};
