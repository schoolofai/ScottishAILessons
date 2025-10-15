
def process_data(data):
    result = []
    for item in data:
        if item > 0:
            result.append(item * 2)
    return result

def main():
    data = [1, -2, 3, -4, 5]
    processed = process_data(data)
    print(processed)
