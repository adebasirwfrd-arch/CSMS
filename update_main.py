with open("main.py", "r") as f:
    content = f.read()
    
# We want to replace get_ll_indicators with supabase_service.get_ll_indicators for the LL indicator endpoints.
# The endpoint defs:
# def get_ll_indicators_route(...)
#     indicators = get_ll_indicators(project_id, year, month)
#     ...
#     success = save_ll_indicator(project_id, default_data)
#     ...
#     indicators = get_ll_indicators(project_id, target_year, target_month)
#
# def save_ll_indicator_route(...)
#     success = save_ll_indicator(project_id, data)

content = content.replace("indicators = get_ll_indicators(", "indicators = supabase_service.get_ll_indicators(")
content = content.replace("success = save_ll_indicator(", "success = supabase_service.save_ll_indicator(")

with open("main.py", "w") as f:
    f.write(content)
print("Updated main.py supabase calls")
