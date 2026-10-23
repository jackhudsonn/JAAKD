{#
  Use each folder's +schema (dbt_project.yml) exactly as written: analytics_staging, analytics.

  dbt calls this macro for every model to decide its schema. The built-in version prefixes the
  profile's schema ("analytics_staging" + "_" + "analytics" = analytics_staging_analytics), which
  is meant for giving each developer their own copy. Here the schemas are fixed: they're created by
  analytics/db/setup.sql, and the backend's reader role can only see "analytics".
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
