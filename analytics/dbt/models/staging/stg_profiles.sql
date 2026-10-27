-- One row per user: the non-identifying profile fields only. age_band was computed on prod from dob.

select
    "userID" as user_id,
    cast("userType" as int) as user_type,
    state,
    country,
    "ageBand" as age_band
from {{ source('raw', 'profiles') }}
