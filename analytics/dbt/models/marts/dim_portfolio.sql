-- One row per portfolio, with its owner's non-identifying profile fields for grouping and filtering
-- (user type, country, state, age band). No names, emails, birth dates or portfolio names: they never leave prod.

select
    portfolios.portfolio_id,
    portfolios.user_id,
    profiles.user_type,
    profiles.country,
    profiles.state,
    profiles.age_band
from {{ ref('stg_portfolios') }} as portfolios
left join {{ ref('stg_profiles') }} as profiles
    on profiles.user_id = portfolios.user_id
