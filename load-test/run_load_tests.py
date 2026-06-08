import xml.etree.ElementTree as ET
import subprocess
import os
import csv
import sys
import time

jmx_path = r"c:\Users\Foxi8\diplom\web-trainer-platform\load-test\web-trainer-test-plan-regex.jmx"
output_dir = r"c:\Users\Foxi8\diplom\web-trainer-platform\load-test"

groups = [
    {"name": "Тестовая группа 1 (10/20/5)", "auth": 10, "courses": 20, "code": 5, "delay": 1000, "ramp_up": 20},
    {"name": "Тестовая группа 2 (50/100/20)", "auth": 50, "courses": 100, "code": 20, "delay": 250, "ramp_up": 20},
    {"name": "Тестовая группа 3 (150/300/50)", "auth": 150, "courses": 300, "code": 50, "delay": 30, "ramp_up": 25}
]

def configure_jmx(auth, courses, code, delay, ramp_up, output_jmx):
    tree = ET.parse(jmx_path)
    root = tree.getroot()
    
    # Настройка количества потоков и времени разгона (Ramp-up)
    for tg in root.iter('ThreadGroup'):
        testname = tg.attrib.get('testname', '')
        if "Сценарий 1: Авторизация" in testname:
            for child in tg:
                if child.attrib.get('name') == 'ThreadGroup.num_threads':
                    child.text = str(auth)
                elif child.attrib.get('name') == 'ThreadGroup.ramp_time':
                    child.text = str(ramp_up)
        elif "Сценарий 2: Каталог курсов (пик)" in testname:
            for child in tg:
                if child.attrib.get('name') == 'ThreadGroup.num_threads':
                    child.text = str(courses)
                elif child.attrib.get('name') == 'ThreadGroup.ramp_time':
                    child.text = str(ramp_up)
        elif "Сценарий 3: Выполнение кода (стресс)" in testname:
            for child in tg:
                if child.attrib.get('name') == 'ThreadGroup.num_threads':
                    child.text = str(code)
                elif child.attrib.get('name') == 'ThreadGroup.ramp_time':
                    child.text = str(ramp_up)
                    
    # Настройка сложного кода (Bubble Sort) c 5 тест-кейсами для Piston
    for http in root.iter('HTTPSamplerProxy'):
        testname = http.attrib.get('testname', '')
        if "POST /api/run-tests" in testname:
            for prop in http.iter('stringProp'):
                if prop.attrib.get('name') == 'Argument.value':
                    # Внедряем Bubble Sort и массив тест-кейсов
                    prop.text = '{"language": "javascript", "code": "function bubbleSort(arr) { for (let i = 0; i < arr.length; i++) { for (let j = 0; j < arr.length - 1 - i; j++) { if (arr[j] > arr[j + 1]) { let t = arr[j]; arr[j] = arr[j + 1]; arr[j + 1] = t; } } } return arr; }", "function_name": "bubbleSort", "test_cases": [{"input": [[5, 3, 8, 4, 2]], "expected_output": [2, 3, 4, 5, 8]}, {"input": [[1, 2, 3]], "expected_output": [1, 2, 3]}, {"input": [[9, 1, 5, 6]], "expected_output": [1, 5, 6, 9]}, {"input": [[]], "expected_output": []}, {"input": [[10, -2, 4]], "expected_output": [-2, 4, 10]}]}'

    # Настройка задержек таймеров (ConstantTimer)
    for timer in root.iter('ConstantTimer'):
        for child in timer:
            if child.attrib.get('name') == 'ConstantTimer.delay':
                child.text = str(delay)
                    
    tree.write(output_jmx, encoding="utf-8", xml_declaration=True)

def parse_jtl(jtl_path):
    stats = {}
    total_requests = 0
    total_errors = 0
    max_time = 0
    start_time = None
    end_time = None
    
    if not os.path.exists(jtl_path):
        print(f"Error: JTL file {jtl_path} not found!")
        return None
        
    with open(jtl_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                elapsed = int(row['elapsed'])
                label = row['label']
                success = row['success'] == 'true'
                timestamp = int(row['timeStamp'])
            except Exception as e:
                continue
            
            if start_time is None or timestamp < start_time:
                start_time = timestamp
            if end_time is None or (timestamp + elapsed) > end_time:
                end_time = timestamp + elapsed
                
            total_requests += 1
            if not success:
                total_errors += 1
                
            if elapsed > max_time:
                max_time = elapsed
                
            mapped_label = None
            if "POST /api/auth/login" in label:
                mapped_label = "POST /api/auth/login"
            elif "GET /api/auth/me" in label:
                mapped_label = "GET /api/auth/me"
            elif label == "GET /api/courses":
                mapped_label = "GET /api/courses"
            elif "POST /api/run-tests" in label or "POST /api/run/tests" in label:
                mapped_label = "POST /api/run/tests"
                
            if mapped_label:
                if mapped_label not in stats:
                    stats[mapped_label] = []
                stats[mapped_label].append(elapsed)
                
    agg_stats = {}
    for label, times in stats.items():
        agg_stats[label] = round(sum(times) / len(times)) if times else 0
        
    duration_sec = (end_time - start_time) / 1000.0 if (end_time and start_time) else 1.0
    throughput = total_requests / duration_sec if duration_sec > 0 else 0
    error_percent = (total_errors / total_requests) * 100 if total_requests > 0 else 0
    
    return {
        "averages": agg_stats,
        "max_time": max_time,
        "total_requests": total_requests,
        "error_percent": round(error_percent, 2),
        "throughput": round(throughput, 2)
    }

def main():
    print("=" * 60)
    print("ЗАПУСК НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ ДЛЯ ТРЕХ ГРУПП...")
    print("=" * 60)
    
    results = {}
    
    for i, g in enumerate(groups, 1):
        name = g["name"]
        print(f"\n[Группа {i}/3] Запуск {name}...")
        
        temp_jmx = os.path.join(output_dir, f"temp_group{i}.jmx")
        temp_jtl = os.path.join(output_dir, f"results_group{i}.jtl")
        temp_report = os.path.join(output_dir, f"report_group{i}")
        
        # Очистка старых логов
        if os.path.exists(temp_jtl):
            os.remove(temp_jtl)
        if os.path.exists(temp_report):
            import shutil
            shutil.rmtree(temp_report, ignore_errors=True)
            
        print(f"  -> Настройка JMX (Auth: {g['auth']}, Courses: {g['courses']}, Code: {g['code']}, Delay: {g['delay']}ms, Ramp-up: {g['ramp_up']}s)...")
        configure_jmx(g["auth"], g["courses"], g["code"], g["delay"], g["ramp_up"], temp_jmx)
        
        print("  -> Запуск JMeter в режиме CLI...")
        cmd = f'jmeter -n -t "{temp_jmx}" -l "{temp_jtl}"'
        p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        
        if os.path.exists(temp_jmx):
            os.remove(temp_jmx)
            
        if p.returncode != 0:
            print(f"  [Ошибка] JMeter завершился с кодом {p.returncode}:")
            print(p.stderr)
            continue
            
        print("  -> Сбор результатов...")
        stats = parse_jtl(temp_jtl)
        if stats:
            results[name] = stats
            print(f"  -> Успешно! Запросов: {stats['total_requests']}, Ошибок: {stats['error_percent']}%, Throughput: {stats['throughput']} req/s")
            
            print(f"  -> Генерация HTML-отчета в папку report_group{i}...")
            report_cmd = f'jmeter -g "{temp_jtl}" -o "{temp_report}"'
            subprocess.run(report_cmd, shell=True, capture_output=True)
        else:
            print("  [Ошибка] Не удалось распарсить лог-файл.")
            
    if not results:
        print("\n[Ошибка] Не удалось собрать результаты тестов.")
        return
        
    print("\n" + "=" * 60)
    print("ОТЧЕТ ПО РЕЗУЛЬТАТАМ ТЕСТИРОВАНИЯ (ДЛЯ ДИПЛОМА)")
    print("=" * 60 + "\n")
    
    routes = [
        "POST /api/auth/login",
        "GET /api/auth/me",
        "GET /api/courses",
        "POST /api/run/tests"
    ]
    
    print("| Маршрут | Тестовая группа 1 (10/20/5) | Тестовая группа 2 (50/100/20) | Тестовая группа 3 (150/300/50) |")
    print("| :--- | :---: | :---: | :---: |")
    
    for r in routes:
        row_str = f"| {r} | "
        for g in groups:
            g_name = g["name"]
            if g_name in results:
                avg = results[g_name]["averages"].get(r, "-")
                row_str += f"{avg} мс | "
            else:
                row_str += "- | "
        print(row_str)
        
    row_str = "| **Max время** | "
    for g in groups:
        g_name = g["name"]
        if g_name in results:
            row_str += f"**{results[g_name]['max_time']} мс** | "
        else:
            row_str += "- | "
    print(row_str)
    
    row_str = "| **Всего запросов** | "
    for g in groups:
        g_name = g["name"]
        if g_name in results:
            row_str += f"{results[g_name]['total_requests']} | "
        else:
            row_str += "- | "
    print(row_str)
    
    row_str = "| **Error%** | "
    for g in groups:
        g_name = g["name"]
        if g_name in results:
            row_str += f"{results[g_name]['error_percent']}% | "
        else:
            row_str += "- | "
    print(row_str)
    
    row_str = "| **Throughput** | "
    for g in groups:
        g_name = g["name"]
        if g_name in results:
            row_str += f"{results[g_name]['throughput']} req/s | "
        else:
            row_str += "- | "
    print(row_str)
    
    print("\n" + "=" * 60)
    print("Все тесты и HTML-отчеты успешно сгенерированы!")
    print("=" * 60)

if __name__ == "__main__":
    main()
