import mysql.connector

def update_database():
    config = {
        'user': 'root',
        'password': '',
        'host': 'localhost',
        'database': 'chatbot_db'
    }

    try:
        conn = mysql.connector.connect(**config)
        cursor = conn.cursor()

        print("Adding missing columns to 'resumes' table...")
        
        # Add score column
        try:
            cursor.execute("ALTER TABLE resumes ADD COLUMN score FLOAT DEFAULT 0")
            print("✓ Added 'score' column")
        except mysql.connector.Error as e:
            if "Duplicate column" in str(e):
                print("✓ 'score' column already exists")
            else:
                print(f"⚠️  Error adding score: {e}")
        
        # Add job_description column
        try:
            cursor.execute("ALTER TABLE resumes ADD COLUMN job_description TEXT")
            print("✓ Added 'job_description' column")
        except mysql.connector.Error as e:
            if "Duplicate column" in str(e):
                print("✓ 'job_description' column already exists")
            else:
                print(f"⚠️  Error adding job_description: {e}")

        conn.commit()
        cursor.close()
        conn.close()
        print("\n🎉 Database updated successfully!")

    except mysql.connector.Error as err:
        print(f"❌ Error: {err}")
        print("\n⚠️  Make sure XAMPP MySQL is running!")

if __name__ == "__main__":
    update_database()
